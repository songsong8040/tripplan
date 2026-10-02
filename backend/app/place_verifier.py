"""카카오 로컬 API 로 AI 가 실존하지 않는/다른 지역의 장소를 추천하는 문제를 막는다.

1) collect_candidates: 생성 전에 여행 지역의 실제 장소 후보(맛집·카페·명소·테마별)를 수집해 AI 프롬프트에 넣는다.
   → AI 는 후보 목록 안에서만 고르므로 지어낸 가게가 나오지 않는다.
2) verify_plans: 생성 후 모든 장소를 후보/카카오 검색과 대조한다.
   - 찾았고 주소가 여행 지역이면: 정확한 상호명/주소/카카오 장소 URL 로 교체, verified=True
   - 못 찾았거나 다른 지역이면: verified=False (UI 에 '장소 확인 필요' 표시)
   - 키가 없거나 한 곳도 못 찾은 경우(해외 여행 등): verified=None

키 발급: https://developers.kakao.com → 내 애플리케이션 → 앱 키 → REST API 키
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
import statistics
from dataclasses import dataclass

import httpx

from .config import get_settings
from .schemas import MustVisit, NearbyParking, NoteRequirements, PlanItem, PlanOption, TripSpec

logger = logging.getLogger(__name__)

KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
CONCURRENCY = 5
MAX_CANDIDATES = 90

_SUFFIX = re.compile(r"(본점|직영점)$")
_NON_WORD = re.compile(r"[\s\-·()\[\]&'.,!]")
_ADMIN_SUFFIX = re.compile(r"(특별자치시|특별자치도|특별시|광역시|시|군|구|도|읍|면|동)$")

# 테마별 추가 검색어 (지역명 뒤에 붙인다)
THEME_QUERIES: dict[str, list[str]] = {
    "힐링": ["산책로", "공원"],
    "맛집 투어": ["맛집", "노포"],
    "카페 투어": ["카페", "디저트"],
    "야외 액티비티": ["액티비티", "체험"],
    "실내 문화/전시": ["전시", "박물관"],
    "쇼핑": ["쇼핑"],
    "호캉스": ["호텔"],
    "자연 경관": ["자연 명소"],
    "역사 탐방": ["유적지"],
    "야경/나이트라이프": ["야경", "술집"],
    "실내 액티비티": ["방탈출", "볼링장", "실내 클라이밍"],
    "체험/클래스": ["원데이클래스", "공방 체험"],
    "테마파크": ["테마파크", "놀이공원"],
    "바다/해변": ["해수욕장", "해변"],
    "등산/트레킹": ["등산로", "트레킹"],
    "스파/온천": ["온천", "스파"],
    "공연/축제": ["공연장", "축제"],
    "사진 명소": ["포토스팟", "사진 명소"],
    "로컬 시장": ["전통시장", "야시장"],
    "드라이브": ["드라이브 코스", "전망대"],
    "아이와 함께": ["키즈카페", "아이와 가볼만한곳"],
    "반려동물 동반": ["애견동반", "반려견 동반"],
}
BASE_QUERIES = ["맛집", "카페", "가볼만한곳"]

# 이동 수단별 실효 속도(km/h, 대기·환승 포함 대략값). 후보 반경 = 속도 × 최대 이동 시간 × RADIUS_FACTOR
SPEED_KMH: dict[str, float] = {"도보 위주": 4.0, "대중교통": 15.0, "미정": 15.0, "자차": 30.0}
# 두 후보가 중심 반대편에 있으면 서로 2배 거리이므로 반경은 이동 가능 거리보다 작게 잡는다
RADIUS_FACTOR = 0.6
MIN_RADIUS_KM = 0.8


@dataclass
class Candidate:
    name: str
    category: str
    address: str
    place_url: str
    dong: str = ""
    x: float | None = None  # 경도
    y: float | None = None  # 위도
    km_from_center: float | None = None
    category_path: str = ""  # 카카오 업종 전체 경로
    requested: bool = False  # 사용자가 추가 요청에서 직접 언급한 장소
    requested_day: int | None = None  # 요청한 날짜 (몇 일차)
    requested_slot: str = ""  # 요청한 시간대 (점심/저녁 등)


def _normalize(name: str) -> str:
    name = re.sub(r"^\[예시\]\s*", "", name)
    return _NON_WORD.sub("", name).lower()


def _core(name: str) -> str:
    """지점명(본점, 스타필드하남점 등)을 뗀 핵심 상호명"""
    tokens = re.sub(r"^\[예시\]\s*", "", name).split()
    if len(tokens) > 1 and tokens[-1].endswith("점"):
        tokens = tokens[:-1]  # "스몹 스타필드하남점" -> "스몹"
    n = _normalize(" ".join(tokens))
    stripped = _SUFFIX.sub("", n) if n.endswith(("본점", "직영점")) else n  # "초계국수본점" -> "초계국수"
    return stripped if len(stripped) >= 2 else n


def _strip_branch(name: str) -> str:
    """'미사리밀빛초계국수 본점' -> '미사리밀빛초계국수' (검색어용, 공백 유지)"""
    tokens = re.sub(r"^\[예시\]\s*", "", name).split()
    if len(tokens) > 1 and tokens[-1].endswith("점"):
        tokens = tokens[:-1]
    return " ".join(tokens)


def _is_match(ai_name: str, place_name: str) -> bool:
    a, b = _core(ai_name), _core(place_name)
    if not a or not b:
        return False
    return a in b or b in a


def region_tokens(region: str) -> list[str]:
    """'하남시' -> ['하남'], '부산 해운대' -> ['부산', '해운대']"""
    tokens = []
    for t in re.split(r"[\s,/]+", region.strip()):
        core = _ADMIN_SUFFIX.sub("", t) if len(t) > 2 else t
        if len(core) >= 2:
            tokens.append(core)
    return tokens


_AREA_CACHE: dict[str, list[str]] = {}


async def expand_region_tokens(client: httpx.AsyncClient, tokens: list[str]) -> list[str]:
    """'잠실'처럼 동네 이름으로 적은 지역을 실제 시·군·구('송파')까지 넓힌다.
    카카오 도로명 주소에는 '잠실'이 없고 '서울 송파구 …' 로만 나오기 때문."""
    out = list(tokens)
    for t in tokens:
        if t not in _AREA_CACHE:
            areas: list[str] = []
            for doc in (await _search(client, t))[:3]:
                parts = (doc.get("address_name") or "").split()
                if len(parts) > 1:
                    core = _ADMIN_SUFFIX.sub("", parts[1]) if len(parts[1]) > 2 else parts[1]
                    if len(core) >= 2 and core not in areas:
                        areas.append(core)
            _AREA_CACHE[t] = areas[:2]
        out += [a for a in _AREA_CACHE[t] if a not in out]
    return out


def in_region(address: str, tokens: list[str]) -> bool:
    """주소가 여행 지역 안인지. 지역 토큰 중 하나라도 주소에 있으면 인정"""
    if not tokens:
        return True
    compact = address.replace(" ", "")
    return any(t in compact for t in tokens)


FACILITY_WORDS = ("주차장", "정류장", "ATM", "화장실", "주유소", "충전소", "출입구")


def _is_facility(doc: dict) -> bool:
    """'OO 본점 주차장' 같은 부속 시설 결과는 장소 매칭·후보에서 제외한다."""
    text = f"{doc.get('place_name', '')} {doc.get('category_name', '')}"
    return any(w in text for w in FACILITY_WORDS)


def _to_candidate(doc: dict) -> Candidate:
    jibun = (doc.get("address_name") or "").split()
    try:
        x, y = float(doc["x"]), float(doc["y"])
    except (KeyError, TypeError, ValueError):
        x = y = None
    return Candidate(
        name=doc.get("place_name", ""),
        category=(doc.get("category_name") or "").split(" > ")[-1],
        category_path=doc.get("category_name") or "",
        address=doc.get("road_address_name") or doc.get("address_name", ""),
        place_url=doc.get("place_url", ""),
        dong=jibun[2] if len(jibun) > 2 else "",
        x=x,
        y=y,
    )


def _km(a: Candidate, lon: float, lat: float) -> float:
    """하버사인 거리(km)"""
    if a.x is None or a.y is None:
        return 0.0
    r = 6371.0
    p1, p2 = math.radians(lat), math.radians(a.y)
    dp, dl = p2 - p1, math.radians(a.x - lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def radius_km(transport: str, max_minutes: int) -> float:
    speed = SPEED_KMH.get(transport, 15.0)
    return max(MIN_RADIUS_KM, round(speed * max_minutes / 60 * RADIUS_FACTOR, 1))


def _limit_by_distance(
    candidates: list[Candidate], transport: str, max_minutes: int, centers: list[tuple[float, float]] | None = None
) -> list[Candidate]:
    """여행 중심(예약 숙소들 중 가장 가까운 곳, 숙소가 없으면 후보들의 중앙값)에서
    이동 수단·최대 이동 시간으로 정한 반경 밖의 후보를 뺀다."""
    located = [c for c in candidates if c.x is not None and c.y is not None]
    if not located:
        return candidates
    if not centers:
        centers = [
            (statistics.median(c.y for c in located), statistics.median(c.x for c in located))  # type: ignore[misc]
        ]
    for c in candidates:
        c.km_from_center = round(min(_km(c, lon, lat) for lat, lon in centers), 1)
    radius = radius_km(transport, max_minutes)
    kept = [c for c in candidates if (c.km_from_center or 0) <= radius]
    # 너무 많이 잘리면(지역이 넓은 경우) 가까운 순으로 최소 30곳은 남긴다
    if len(kept) < 30:
        kept = sorted(candidates, key=lambda c: c.km_from_center or 0)[: max(30, len(kept))]
    return kept


def _client(key: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(headers={"Authorization": f"KakaoAK {key}"}, timeout=5.0)


async def _search(client: httpx.AsyncClient, query: str, page: int = 1) -> list[dict]:
    try:
        res = await client.get(KAKAO_KEYWORD_URL, params={"query": query, "size": 15, "page": page})
        if res.status_code != 200:
            logger.warning("카카오 검색 실패(%s): %s", res.status_code, res.text[:120])
            return []
        return res.json().get("documents", [])
    except httpx.HTTPError as exc:
        logger.warning("카카오 검색 오류: %s", exc)
        return []


# ---------------------------------------------------------------------------
# 1) 생성 전: 실제 장소 후보 수집
# ---------------------------------------------------------------------------

_PARTICLE = re.compile(r"(에서|으로|까지|부터|이랑|하고|을|를|이|가|은|는|에|도|로|랑|와|과|의)$")
_STOPWORDS = {"여행", "가서", "어른들", "아이들", "친구들", "부모님", "디저트", "맛집", "카페", "근처", "주변", "그리고", "좋아해서", "좋겠어요", "싶어요", "갈거야", "가고", "먹는", "것도"}


def _note_keywords(notes: str, region_toks: list[str]) -> list[str]:
    """추가 요청 문구에서 장소 이름일 수 있는 단어를 뽑는다: '스타필드 가서 스몹을' -> ['스타필드', '스몹']"""
    words = []
    for raw in re.findall(r"[가-힣A-Za-z0-9]+", notes):
        w = _PARTICLE.sub("", raw) if len(raw) > 2 else raw
        if len(w) < 2 or w in _STOPWORDS or any(w in t or t in w for t in region_toks):
            continue
        if re.search(r"(해요|하고|해서|거야|어요|아요|는데|니다|으면|려고|했어|싶|좋)", raw):
            continue  # 서술어
        words.append(w)
    return list(dict.fromkeys(words))[:8]


async def _requested_places(client: httpx.AsyncClient, spec: TripSpec, tokens: list[str]) -> list[Candidate]:
    """추가 요청에 이름이 나온 장소를 카카오에서 찾아 '반드시 포함' 후보로 만든다."""
    found: list[Candidate] = []
    for word in _note_keywords(spec.notes, tokens):
        for doc in [d for t in (region_tokens(spec.region) or [spec.region]) for d in await _search(client, f"{t} {word}")]:
            if _is_facility(doc):
                continue
            c = _to_candidate(doc)
            if _normalize(word) in _normalize(c.name) and in_region(c.address, tokens):
                c.requested = True
                found.append(c)
                break
    return found


async def _must_visit_places(
    client: httpx.AsyncClient, reqs: NoteRequirements, areas: list[str], tokens: list[str]
) -> list[Candidate]:
    """요청 메모에서 뽑은 '꼭 갈 곳'을 그날 지역(없으면 여행 지역들)에서 찾는다."""
    day_area = {d.day: d.area for d in reqs.day_areas}
    found: list[Candidate] = []
    for m in reqs.must_visit:
        where = [day_area[m.day]] if m.day in day_area else areas
        pick = None
        for q in [*(f"{a} {m.name}" for a in where), m.name]:
            for doc in await _search(client, q):
                if _is_facility(doc):
                    continue
                c = _to_candidate(doc)
                if _is_match(m.name, c.name) and in_region(c.address, tokens):
                    pick = c
                    break
            if pick:
                break
        if pick:
            pick.requested, pick.requested_day, pick.requested_slot = True, m.day, m.slot
            found.append(pick)
        else:
            logger.info("요청 장소를 카카오에서 찾지 못함: %s", m.name)
    return found


async def _area_center(client: httpx.AsyncClient, area: str) -> tuple[float, float] | None:
    for d in (await _search(client, area))[:1]:
        try:
            return float(d["y"]), float(d["x"])
        except (KeyError, TypeError, ValueError):
            return None
    return None


def persona_queries(spec: TripSpec) -> list[str]:
    """일행 성향에 맞춰 더 찾아볼 장소 종류 (예: 젊은 여성 일행 → 소품샵·백화점)"""
    ages = set(spec.age_groups)
    young = bool(ages & {"20대", "30대"})
    out: list[str] = []
    if young and spec.gender_mix in ("여성만", "혼성", "미정"):
        out += ["소품샵", "백화점", "포토스팟"]
    if young and spec.gender_mix == "남성만":
        out += ["실내 스포츠", "보드게임카페"]
    if "영유아" in ages or "10대" in ages:
        out += ["키즈카페" if "영유아" in ages else "체험"]
    return out


async def collect_candidates(spec: TripSpec, reqs: NoteRequirements | None = None) -> list[Candidate]:
    key = get_settings().kakao_rest_api_key
    if not key:
        return []
    region = spec.region.strip()
    base_tokens = region_tokens(region)
    # 날짜별로 노는 지역이 따로 있으면 그 지역도 검색 지역에 넣는다
    for d in (reqs.day_areas if reqs else []):
        for t in region_tokens(d.area):
            if t not in base_tokens:
                base_tokens.append(t)
    words = list(dict.fromkeys([*BASE_QUERIES, *(q for t in spec.themes for q in THEME_QUERIES.get(t, [])), *persona_queries(spec)]))
    # '하남, 잠실'처럼 지역이 여러 곳이면 지역마다 따로 검색한다 (한 문장으로 검색하면 결과가 거의 없음)
    areas = base_tokens if len(base_tokens) > 1 else [region]
    queries = [(f"{a} {w}", 1) for a in areas for w in words] + [(f"{a} 맛집", 2) for a in areas]

    sem = asyncio.Semaphore(CONCURRENCY)

    async def run(query: str, page: int) -> list[dict]:
        async with sem:
            return await _search(client, query, page)

    async with _client(key) as client:
        tokens = await expand_region_tokens(client, base_tokens)
        # 조건 화면에서 고른 '꼭 갈 곳'은 좌표까지 있으니 검색 없이 바로 후보로 쓴다
        picked = [
            Candidate(
                name=m.name, category="", address=m.address, place_url=m.place_url or f"must:{m.name}",
                x=m.lng, y=m.lat, requested=True, requested_day=m.day, requested_slot=m.slot,
            )
            for m in spec.must_visits
            if m.lat is not None and m.lng is not None
        ]
        # 이름만 적은 꼭 갈 곳은 검색해서 찾는다
        if reqs is not None:
            for m in spec.must_visits:
                if m.lat is None and not any(_is_match(m.name, x.name) for x in reqs.must_visit):
                    reqs.must_visit.append(MustVisit(name=m.name, day=m.day, slot=m.slot))
        if reqs:
            reqs.must_visit = [x for x in reqs.must_visit if not any(_is_match(x.name, p.name) for p in picked)]
        find_requested = (
            _must_visit_places(client, reqs, areas, tokens)
            if reqs and reqs.must_visit
            else (_requested_places(client, spec, tokens) if not picked else asyncio.sleep(0, result=[]))
        )
        requested, results = await asyncio.gather(find_requested, asyncio.gather(*(run(q, p) for q, p in queries)))
        requested = picked + list(requested)
        # 지역이 여러 곳이면 지역마다 중심을 따로 둔다 (두 지역 한가운데를 중심으로 잡으면 양쪽이 다 잘림)
        area_centers = (
            [c for c in await asyncio.gather(*(_area_center(client, a) for a in areas)) if c] if len(areas) > 1 else []
        )

    seen: set[str] = {c.place_url for c in requested}
    candidates: list[Candidate] = []
    # 검색어별 결과를 번갈아 담아 특정 카테고리에 쏠리지 않게 한다
    for rank in range(15):
        for docs in results:
            if rank < len(docs) and not _is_facility(docs[rank]):
                c = _to_candidate(docs[rank])
                if c.name and c.place_url not in seen and in_region(c.address, tokens) and not is_excluded(c.category_path, spec.excluded_cuisines):
                    seen.add(c.place_url)
                    candidates.append(c)
    before = len(candidates)
    # 사용자가 요청한 장소도 중심 좌표 계산에 포함하되, 반경 필터와 개수 제한에서는 항상 살린다
    centers = [(l.lat, l.lng) for l in spec.lodgings if l.lat is not None and l.lng is not None] + area_centers
    candidates = _limit_by_distance(requested + candidates, spec.transport, spec.max_travel_minutes, centers)
    candidates = [c for c in requested] + [c for c in candidates if not c.requested]
    logger.info(
        "카카오 후보 장소 %d곳 → %s %d분(반경 %.1fkm) 적용 후 %d곳, 요청 장소 %s (%s)",
        before, spec.transport, spec.max_travel_minutes,
        radius_km(spec.transport, spec.max_travel_minutes), len(candidates),
        [c.name for c in requested], region,
    )
    return candidates[:MAX_CANDIDATES]


def candidates_prompt(candidates: list[Candidate]) -> str:
    if not candidates:
        return ""
    def line(c: Candidate) -> str:
        dist = f" | 중심에서 {c.km_from_center}km" if c.km_from_center is not None else ""
        when = " ".join(x for x in [f"{c.requested_day}일차" if c.requested_day else "", c.requested_slot] if x)
        mark = f"★사용자 요청({when + ', ' if when else ''}반드시 포함) | " if c.requested else ""
        kind = " > ".join(c.category_path.split(" > ")[1:]) or c.category
        return f"- {mark}{c.name} | {kind} | {c.dong or '-'} | {c.address}{dist}"

    lines = "\n".join(line(c) for c in candidates)
    return (
        "\n\n[실제 장소 후보 목록 — 카카오맵에 등록된 실존 장소]\n"
        f"{lines}\n\n"
        "장소(name)는 반드시 위 후보 목록에 있는 이름을 글자 그대로 사용하세요. "
        "목록에 없는 장소는 '추가 요청'에서 사용자가 직접 이름을 언급한 곳만 예외로 허용합니다. "
        "area 에는 후보의 동(洞)이나 역 수준 위치를 적으세요. "
        "하루 일정은 같은 동 또는 인접한 동의 후보끼리 묶어 이동을 최소화하세요. "
        "★사용자 요청 장소는 1안과 2안 모두에 반드시 넣고, 그 주변 장소로 동선을 짜세요."
    )


async def search_kakao_places(query: str, limit: int = 8) -> list[dict]:
    """여행 조건 입력용 장소 검색(숙소 선택 등)"""
    key = get_settings().kakao_rest_api_key
    if not key:
        return []
    async with _client(key) as client:
        docs = [d for d in await _search(client, query) if not _is_facility(d)]
    return [
        {"name": c.name, "address": c.address, "place_url": c.place_url, "lat": c.y, "lng": c.x, "category": c.category}
        for c in map(_to_candidate, docs[:limit])
    ]


# ---------------------------------------------------------------------------
# 4) 자차 여행: 장소별 가장 가까운 주차장
# ---------------------------------------------------------------------------

PARKING_RADIUS_M = 500


async def attach_parking(items: list[PlanItem]) -> None:
    """좌표가 있는 장소마다 반경 500m 안의 가장 가까운 주차장(카카오 PK6)을 찾아 채운다."""
    key = get_settings().kakao_rest_api_key
    targets = [i for i in items if i.lat is not None and i.lng is not None and i.nearby_parking is None]
    if not key or not targets:
        return
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(item: PlanItem) -> None:
        params = {"category_group_code": "PK6", "x": item.lng, "y": item.lat, "radius": PARKING_RADIUS_M, "sort": "distance", "size": 1}
        async with sem:
            try:
                res = await client.get(KAKAO_CATEGORY_URL, params=params)
            except httpx.HTTPError:
                return
        if res.status_code != 200:
            return
        docs = res.json().get("documents", [])
        item.nearby_parking = (
            NearbyParking(name=docs[0]["place_name"], distance_m=int(docs[0].get("distance") or 0), place_url=docs[0].get("place_url", ""))
            if docs
            else NearbyParking(name="", distance_m=0)
        )

    async with _client(key) as client:
        await asyncio.gather(*(one(i) for i in targets))


# ---------------------------------------------------------------------------
# 3) 확인 안 된 장소 → 근처 실제 장소로 교체
# ---------------------------------------------------------------------------

KAKAO_CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
# 일정 카테고리 → 카카오 카테고리 그룹 코드 (없으면 키워드로 검색)
CATEGORY_GROUP = {"식당": "FD6", "카페": "CE7", "관광지": "AT4", "문화/전시": "CT1", "숙소": "AD5"}
CATEGORY_KEYWORD = {"쇼핑": "쇼핑", "액티비티": "체험", "휴식": "공원", "기타": "가볼만한곳"}


async def _nearby(client: httpx.AsyncClient, category: str, lat: float, lng: float, radius_m: int) -> list[dict]:
    # 반경 안에서 정확도(인기) 순으로 받는다
    params = {"x": lng, "y": lat, "radius": radius_m, "sort": "accuracy", "size": 15}
    code = CATEGORY_GROUP.get(category)
    try:
        if code:
            res = await client.get(KAKAO_CATEGORY_URL, params={**params, "category_group_code": code})
        else:
            res = await client.get(KAKAO_KEYWORD_URL, params={**params, "query": CATEGORY_KEYWORD.get(category, "가볼만한곳")})
        return res.json().get("documents", []) if res.status_code == 200 else []
    except httpx.HTTPError as exc:
        logger.warning("카카오 주변 검색 오류: %s", exc)
        return []


CUISINES = ("한식", "중식", "일식", "양식", "분식", "패스트푸드", "뷔페", "술집", "치킨", "아시아음식")


def is_excluded(category_path: str, avoid: list[str] | None) -> bool:
    """카카오 업종 경로가 빼 달라는 음식 종류에 해당하는지 ('음식점 > 한식 > 국수' ∈ 한식)"""
    return any(f"> {a}" in category_path for a in (avoid or []))


def excluded_cuisines(rules: list[str]) -> list[str]:
    """'점심은 한식 제외'처럼 규칙에서 빼라고 한 음식 종류를 뽑는다 (교체 장소 고를 때 사용)"""
    out = []
    for r in rules:
        if any(w in r for w in ("제외", "빼", "말고", "말 것", "않")):
            out += [c for c in CUISINES if c in r and c not in out]
    return out


async def _nearby_keyword(client: httpx.AsyncClient, word: str, lat: float, lng: float, radius_m: int) -> list[dict]:
    params = {"x": lng, "y": lat, "radius": radius_m, "sort": "accuracy", "size": 5, "query": word, "category_group_code": "FD6"}
    try:
        res = await client.get(KAKAO_KEYWORD_URL, params=params)
        return res.json().get("documents", []) if res.status_code == 200 else []
    except httpx.HTTPError:
        return []


async def find_replacements(
    requests: list[tuple[PlanItem, tuple[float, float]]],
    region: str,
    exclude_urls: set[str],
    avoid: list[str] | None = None,
) -> dict[str, Candidate]:
    """(확인 안 된 아이템, 기준 좌표) 목록을 받아 아이템 id → 근처 실제 장소 후보를 돌려준다."""
    key = get_settings().kakao_rest_api_key
    if not key or not requests:
        return {}
    used = set(exclude_urls)
    out: dict[str, Candidate] = {}
    async with _client(key) as client:
        tokens = await expand_region_tokens(client, region_tokens(region))
        for item, (lat, lng) in requests:  # 순서대로 처리해 같은 장소가 중복 배정되지 않게 한다
            for radius in (1000, 3000):
                raw = await _nearby(client, item.category, lat, lng, radius)
                if item.category == "식당" and avoid:
                    # 주변이 온통 빼 달라는 종류(예: 한식)일 수 있어 다른 음식 종류로도 찾아 둔다
                    for word in [c for c in ("양식", "일식", "중식", "아시아음식", "브런치") if c not in avoid]:
                        raw += await _nearby_keyword(client, word, lat, lng, radius)
                docs = [
                    d
                    for d in raw
                    if not _is_facility(d)
                    # 식사 자리에 아이스크림·디저트 같은 간식류가 들어가지 않게 한다
                    and not (item.category == "식당" and "> 간식" in (d.get("category_name") or ""))
                    # 사용자가 빼 달라고 한 음식 종류(예: 한식)는 고르지 않는다
                    and not any(f"> {a}" in (d.get("category_name") or "") for a in (avoid or []))
                ]
                pick = next(
                    (
                        c
                        for c in map(_to_candidate, docs)
                        if c.place_url not in used and in_region(c.address, tokens)
                    ),
                    None,
                )
                if pick:
                    used.add(pick.place_url)
                    out[item.id] = pick
                    break
    return out


def apply_replacement(item: PlanItem, c: Candidate) -> str:
    """아이템을 새 장소로 바꾸고 이전 이름을 돌려준다. 시간·체류·메모·투표는 유지한다."""
    old = item.name
    _apply(item, c)
    item.reason = f"원래 추천된 '{old}'을(를) 카카오맵에서 찾을 수 없어 근처 {c.category or item.category}(으)로 바꿨어요."
    item.area = c.dong or item.area
    item.open_time = item.close_time = item.break_start = item.break_end = item.tip = ""
    item.closed_days = []
    item.reservation_recommended = item.on_catchtable = item.on_naver_booking = False
    item.parking, item.parking_note, item.nearby_parking = "모름", "", None
    return old


# ---------------------------------------------------------------------------
# 2) 생성 후: 모든 장소 검증
# ---------------------------------------------------------------------------


def _apply(item: PlanItem, c: Candidate) -> None:
    item.name = c.name
    item.address = c.address
    item.place_url = c.place_url
    # 네이버/구글 지도용 검색어: 시·구 + 정확한 상호명
    item.search_keyword = " ".join([*c.address.split()[:2], c.name])
    item.lat, item.lng = c.y, c.x
    item.kakao_category = c.category_path
    item.verified = True


async def _verify_item(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: PlanItem,
    region: str,
    tokens: list[str],
    by_name: dict[str, Candidate],
) -> bool:
    # 후보 목록에 있는 이름이면 API 호출 없이 확정
    exact = by_name.get(_normalize(item.name))
    if exact:
        _apply(item, exact)
        return True

    # 카카오는 '본점' 같은 지점명을 붙이면 못 찾는 경우가 많아, 지점명을 뗀 이름·지역 약칭으로도 검색한다
    short_region = " ".join(tokens) or region
    base_name = _strip_branch(item.name)
    queries = list(
        dict.fromkeys(
            q
            for q in (
                f"{region} {item.name}",
                item.search_keyword,
                *(f"{t} {base_name}" for t in tokens),
                f"{short_region} {base_name}",
                base_name,
            )
            if q.strip()
        )
    )
    async with sem:
        for query in queries:
            docs = [d for d in await _search(client, query) if not _is_facility(d)]
            matches = [
                c for c in map(_to_candidate, docs) if _is_match(item.name, c.name) and in_region(c.address, tokens)
            ]
            if matches:
                # 핵심 상호명이 정확히 같은 결과를 우선한다
                matches.sort(key=lambda c: _core(c.name) != _core(item.name))
                _apply(item, matches[0])
                return True
    item.verified = False
    return False


async def verify_plans(plans: list[PlanOption], region: str, candidates: list[Candidate] | None = None) -> None:
    items = [item for plan in plans for day in plan.days for item in day.items if item.category != "이동"]
    await verify_items(items, region, candidates)


async def verify_items(items: list[PlanItem], region: str, candidates: list[Candidate] | None = None) -> None:
    """items 를 카카오와 대조해 이름/주소/좌표를 채운다(제자리 수정)."""
    key = get_settings().kakao_rest_api_key
    if not key or not items:
        return

    by_name = {_normalize(c.name): c for c in candidates or []}
    sem = asyncio.Semaphore(CONCURRENCY)
    async with _client(key) as client:
        tokens = await expand_region_tokens(client, region_tokens(region))
        results = await asyncio.gather(*(_verify_item(client, sem, item, region, tokens, by_name) for item in items))

    matched = sum(1 for r in results if r)
    logger.info("카카오 장소 검증: %d/%d 확인", matched, len(items))
    if matched == 0 and len(items) > 1:
        # 한 곳도 못 찾으면 해외 여행이거나 키/쿼터 문제 → 검증 결과를 표시하지 않는다
        for item in items:
            item.verified = None


# ---------------------------------------------------------------------------
# 3) 생성 후: 연속한 두 장소의 이동 시간 한도를 지키도록 먼 장소를 가까운 곳으로 교체
# ---------------------------------------------------------------------------

# 직선 거리 → 실제 길 거리 보정, 이동 수단별 속도(km/h)
DETOUR = 1.3
WALK_KMH, TRANSIT_KMH, CAR_KMH = 4.0, 15.0, 30.0


def _pair_km(a: PlanItem, b: PlanItem) -> float:
    if a.lat is None or a.lng is None or b.lat is None or b.lng is None:
        return 0.0
    return _km(Candidate("", "", "", "", x=b.lng, y=b.lat), a.lng, a.lat)


def max_hop_km(spec: TripSpec) -> float:
    """연속한 두 장소 사이 허용 직선 거리(km)"""
    if spec.transport == "도보 위주":
        return WALK_KMH * spec.max_travel_minutes / 60 / DETOUR
    if spec.transport == "자차":
        return CAR_KMH * spec.max_travel_minutes / 60 / DETOUR
    # 대중교통·미정: 걸어서 가능한 거리와 대중교통으로 가능한 거리 중 큰 쪽
    walk = WALK_KMH * spec.max_walk_minutes / 60 / DETOUR
    transit = TRANSIT_KMH * spec.max_travel_minutes / 60 / DETOUR
    return max(walk, transit)


async def enforce_travel_limits(plans: list[PlanOption], spec: TripSpec, keep: set[str] | None = None) -> int:
    """하루 일정에서 앞 장소와 너무 먼 장소를 앞 장소 근처의 같은 종류 장소로 바꾼다.
    숙소·이동 항목은 기준점으로만 쓰고 바꾸지 않는다. 바꾼 개수를 돌려준다."""
    key = get_settings().kakao_rest_api_key
    if not key:
        return 0
    limit = max_hop_km(spec)
    changed = 0
    async with _client(key) as client:
        tokens = await expand_region_tokens(client, region_tokens(spec.region))
        for plan in plans:
            used = {i.place_url for d in plan.days for i in d.items if i.place_url}
            for day in plan.days:
                items = sorted(day.items, key=lambda i: i.start_time)
                prev: PlanItem | None = None
                for idx, item in enumerate(items):
                    if item.lat is None or item.lng is None or item.category == "이동":
                        continue
                    keep_it = _core(item.name) in (keep or set())
                    if prev is None or item.category == "숙소" or keep_it or _pair_km(prev, item) <= limit:
                        prev = item
                        continue
                    # 다음 장소(있으면)와도 가까운 곳을 우선 고른다
                    nxt = next((n for n in items[idx + 1 :] if n.lat is not None and n.category != "이동"), None)
                    radius_m = max(200, int(limit * 1000))
                    # 원래 장소의 세부 업종(예: '육류,고기')으로 먼저 찾아 비슷한 곳으로 바꾼다
                    parts = [p.strip() for p in item.kakao_category.split(">")]
                    similar = (
                        await _nearby_keyword(client, parts[-1], prev.lat, prev.lng, radius_m)  # type: ignore[arg-type]
                        if item.category == "식당" and len(parts) >= 3
                        else []
                    )
                    docs = [
                        d
                        for d in similar + await _nearby(client, item.category, prev.lat, prev.lng, radius_m)  # type: ignore[arg-type]
                        if not _is_facility(d)
                        and not (item.category == "식당" and "> 간식" in (d.get("category_name") or ""))
                        and not is_excluded(d.get("category_name") or "", spec.excluded_cuisines)
                    ]
                    picks = [
                        c
                        for c in map(_to_candidate, docs)
                        if c.place_url not in used and in_region(c.address, tokens) and c.x is not None
                        and _km(c, prev.lng, prev.lat) <= limit  # type: ignore[arg-type]
                    ]
                    if nxt is not None:
                        picks.sort(key=lambda c: _km(c, nxt.lng, nxt.lat) > limit)  # type: ignore[arg-type]
                    if not picks:
                        prev = item
                        continue
                    pick = picks[0]
                    old = item.name
                    used.discard(item.place_url)
                    used.add(pick.place_url)
                    apply_replacement(item, pick)
                    item.reason = f"'{old}'은(는) 앞 장소에서 너무 멀어서, 설정한 이동 시간 안의 가까운 {pick.category or item.category}(으)로 바꿨어요."
                    changed += 1
                    prev = item
    return changed


# ---------------------------------------------------------------------------
# 4) 생성 후: 사용자가 꼭 가겠다고 한 장소가 빠졌으면 그날 일정에 넣는다
# ---------------------------------------------------------------------------

SLOT_TIME = {"아침": "08:30", "오전": "10:30", "점심": "12:00", "오후": "15:00", "저녁": "18:00"}


def _minutes(hhmm: str) -> int:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except ValueError:
        return 0


def ensure_must_visit(plans: list[PlanOption], requested: list[Candidate]) -> int:
    """요청 장소가 지정한 날(없으면 아무 날)에 없으면, 그 시간대에 가장 가까운 일정을 그 장소로 바꾼다.
    점심·저녁 요청이면 식당 자리를, 아니면 하루에 겹치는 종류(예: 카페 여러 곳) 자리를 우선 바꾼다."""
    changed = 0
    for plan in plans:
        for c in requested:
            days = [d for d in plan.days if c.requested_day in (None, d.day)] or plan.days[:1]
            if any(_is_match(c.name, i.name) for d in days for i in d.items):
                continue
            day = days[0]
            pool = [
                i
                for i in day.items
                if i.category not in ("숙소", "이동") and not any(_is_match(r.name, i.name) for r in requested)
            ]
            if not pool:
                continue
            target = _minutes(SLOT_TIME.get(c.requested_slot, "14:00"))
            meal = c.requested_slot in ("점심", "저녁")
            if meal:
                pool = [i for i in pool if i.category == "식당"] or pool
            else:
                counts: dict[str, int] = {}
                for i in pool:
                    counts[i.category] = counts.get(i.category, 0) + 1
                dup = [i for i in pool if counts[i.category] > 1 and i.category != "식당"]
                pool = dup or [i for i in pool if i.category != "식당"] or pool
            victim = min(pool, key=lambda i: abs(_minutes(i.start_time) - target))
            old = victim.name
            _apply(victim, c)
            if not meal and victim.category in ("식당", "카페"):
                leisure = any(k in c.category for k in ("레저", "스포츠", "체험", "놀이", "테마파크"))
                victim.category = "액티비티" if leisure else "관광지"
            victim.area = c.dong or victim.area
            victim.reason = f"요청하신 장소라 '{old}' 대신 넣었어요."
            victim.open_time = victim.close_time = victim.break_start = victim.break_end = victim.tip = ""
            victim.closed_days = []
            changed += 1
    return changed


# ---------------------------------------------------------------------------
# 5) 생성 후: 하루 일정에 점심·저녁 식당이 빠졌으면 채운다
# ---------------------------------------------------------------------------

# (끼니, 이 시간대 안에 식당이 있어야 함, 기준 시각)
MEALS = (("점심", 10 * 60 + 30, 15 * 60, 12 * 60 + 30), ("저녁", 16 * 60, 21 * 60, 18 * 60 + 30))


async def fill_missing_meals(
    plans: list[PlanOption], region: str, avoid: list[str] | None = None, keep: set[str] | None = None
) -> int:
    """하루 일정이 끼니 시간대를 지나는데 그 시간에 식당이 없으면, 그 시간에 가장 가까운 일정
    (카페가 여러 곳이면 카페 우선, 요청 장소·숙소 제외)을 근처 식당으로 바꾼다."""
    requests: list[tuple[PlanItem, tuple[float, float]]] = []
    meal_of: dict[str, str] = {}
    for plan in plans:
        for day in plan.days:
            items = [i for i in day.items if i.category not in ("숙소", "이동")]
            if not items:
                continue
            first = min(_minutes(i.start_time) for i in items)
            last = max(_minutes(i.start_time) + (i.duration_minutes or 60) for i in items)
            for meal, lo, hi, center in MEALS:
                if not (first <= center <= last):
                    continue  # 그 끼니 시간 전에 끝나거나 후에 시작하는 날
                if any(i.category == "식당" and lo <= _minutes(i.start_time) <= hi for i in items):
                    continue
                pool = [
                    i
                    for i in items
                    if i.lat is not None and _core(i.name) not in (keep or set()) and i.id not in meal_of
                ]
                cafes = [i for i in pool if i.category == "카페"]
                if len(cafes) > 1:
                    pool = cafes
                else:
                    pool = [i for i in pool if i.category not in ("식당", "카페")]
                if not pool:
                    # 바꿀 만한 자리가 없으면(카페 하나·요청 장소뿐) 그 시간에 식당을 새로 끼워 넣는다
                    near = min((i for i in items if i.lat is not None), key=lambda i: abs(_minutes(i.start_time) - center), default=None)
                    if near is None:
                        continue
                    slot = PlanItem(
                        id=f"meal-{day.day}-{meal}-{plan.id}", name=f"{meal} 식사", category="식당",
                        start_time=_hhmm(center - 30), duration_minutes=75, lat=near.lat, lng=near.lng,
                    )
                    day.items.append(slot)
                    meal_of[slot.id] = meal
                    requests.append((slot, (near.lat, near.lng)))  # type: ignore[arg-type]
                    continue
                victim = min(pool, key=lambda i: abs(_minutes(i.start_time) - center))
                meal_of[victim.id] = meal
                probe = victim.model_copy(update={"category": "식당"})
                requests.append((probe, (victim.lat, victim.lng)))  # type: ignore[arg-type]
    if not requests:
        return 0
    exclude = {i.place_url for p in plans for d in p.days for i in d.items if i.place_url}
    found = await find_replacements(requests, region, exclude, avoid=avoid)
    changed = 0
    for plan in plans:
        for day in plan.days:
            day.items = [i for i in day.items if not (i.id.startswith("meal-") and i.id not in found)]
            for item in day.items:
                if item.id in found:
                    old = item.name
                    apply_replacement(item, found[item.id])
                    item.category = "식당"
                    item.reason = f"{meal_of[item.id]} 식사 자리가 비어 있어 '{old}' 대신 근처 식당을 넣었어요."
                    changed += 1
    return changed


# ---------------------------------------------------------------------------
# 6) 생성 후: 빼 달라고 한 음식 종류의 식당이 들어갔으면 다른 종류로 바꾼다
# ---------------------------------------------------------------------------


def cuisine_rules(rules: list[str]) -> list[tuple[int | None, str | None, str]]:
    """'1일차 점심은 한식 제외' → (1, '점심', '한식'). 날짜·끼니가 없으면 None (전체에 적용)"""
    out: list[tuple[int | None, str | None, str]] = []
    for r in rules:
        if not any(w in r for w in ("제외", "빼", "말고", "말 것", "않")):
            continue
        m = re.search(r"(\d+)\s*일차", r)
        day = int(m.group(1)) if m else None
        meal = "점심" if "점심" in r else "저녁" if "저녁" in r else None
        out += [(day, meal, c) for c in CUISINES if c in r]
    return out


def _meal_at(hhmm: str) -> str | None:
    t = _minutes(hhmm)
    return "점심" if 11 * 60 <= t <= 14 * 60 + 30 else "저녁" if 17 * 60 <= t <= 20 * 60 + 30 else None


async def replace_excluded_cuisines(
    plans: list[PlanOption],
    region: str,
    avoid: list[str],
    rules: list[tuple[int | None, str | None, str]] | None = None,
    keep: set[str] | None = None,
) -> int:
    """빼 달라는 음식 종류의 식당을 근처 다른 식당으로 바꾼다.
    avoid 는 모든 끼니에, rules 는 해당 날짜·끼니에만 적용한다."""
    changed = 0
    exclude = {i.place_url for p in plans for d in p.days for i in d.items if i.place_url}
    for plan in plans:
        for day in plan.days:
            for item in day.items:
                if item.category != "식당" or item.lat is None or _core(item.name) in (keep or set()):
                    continue
                here = list(avoid) + [
                    c for d, m, c in (rules or []) if d in (None, day.day) and m in (None, _meal_at(item.start_time))
                ]
                if not is_excluded(item.kakao_category, here):
                    continue
                found = await find_replacements([(item, (item.lat, item.lng))], region, exclude, avoid=here)  # type: ignore[arg-type]
                if item.id in found:
                    old = item.name
                    apply_replacement(item, found[item.id])
                    exclude.add(item.place_url)
                    item.category = "식당"
                    item.reason = f"빼 달라고 하신 음식 종류라 '{old}' 대신 근처 다른 식당을 넣었어요."
                    changed += 1
    return changed


# ---------------------------------------------------------------------------
# 7) 생성 후: 일정 사이에 이동 시간보다 훨씬 긴 빈 시간이 있으면 앞 장소 체류를 늘린다
# ---------------------------------------------------------------------------

# 체류를 늘려도 자연스러운 종류와 최대 체류 시간(분)
STRETCH_MAX = {"카페": 120, "관광지": 180, "쇼핑": 180, "액티비티": 240, "문화/전시": 180, "휴식": 180, "식당": 120, "기타": 150}


def close_gaps(plans: list[PlanOption], spec: TripSpec) -> int:
    """다음 장소 시작까지 (이동 시간 + 15분 여유)보다 많이 비면 앞 장소에 더 머무르게 한다.
    점심·저녁처럼 시각이 중요한 일정은 옮기지 않고, 앞 장소 체류만 늘린다."""
    speed = {"도보 위주": WALK_KMH, "자차": CAR_KMH}.get(spec.transport, TRANSIT_KMH)
    changed = 0
    for plan in plans:
        for day in plan.days:
            items = sorted((i for i in day.items if i.category != "이동"), key=lambda i: i.start_time)
            for cur, nxt in zip(items, items[1:]):
                limit = STRETCH_MAX.get(cur.category)
                if limit is None:
                    continue  # 숙소 등은 그대로
                travel = round(_pair_km(cur, nxt) * DETOUR / speed * 60) if _pair_km(cur, nxt) else 20
                free = _minutes(nxt.start_time) - (_minutes(cur.start_time) + cur.duration_minutes) - travel
                if free > 30:
                    extra = min(free - 15, max(0, limit - cur.duration_minutes))
                    if extra >= 15:
                        cur.duration_minutes += extra
                        changed += 1
    return changed


# ---------------------------------------------------------------------------
# 8) 생성 후: 카페·디저트를 식사 바로 앞에 두지 않는다 (디저트 먹고 바로 밥은 안 먹으니까)
# ---------------------------------------------------------------------------

CAFE_BEFORE_MEAL_MIN = 90  # 카페가 끝나고 식사까지 최소 이만큼은 떨어져야 함
# 식사 직전에 가기엔 배부른 카페 (디저트·빵·브런치 위주)
HEAVY_CAFE = ("디저트", "베이커리", "제과", "케이크", "브런치", "샌드위치", "도넛", "빙수", "베이글")
BUFFER_MIN = 15  # 장소 사이 기본 이동·여유
MIN_STAY = {"카페": 45, "관광지": 45, "쇼핑": 45, "액티비티": 60, "문화/전시": 45, "휴식": 45, "기타": 30}


def _hhmm(total: int) -> str:
    total = max(0, min(total, 23 * 60 + 59))
    return f"{total // 60:02d}:{total % 60:02d}"


def _layout(order: list[PlanItem], day_start: int) -> None:
    """식당·숙소 시각은 고정하고, 그 사이 장소들은 순서대로 이어 붙인다.
    다음 식사 전에 다 안 들어가면 체류 시간을 최소치까지 줄인다."""
    segment: list[PlanItem] = []
    cursor = day_start

    def place(seg: list[PlanItem], start: int, anchor_start: int | None) -> int:
        if anchor_start is not None:
            room = anchor_start - start - BUFFER_MIN * len(seg)
            need = sum(i.duration_minutes for i in seg)
            if seg and need > room:
                # 넘치는 만큼 줄일 수 있는 체류 시간에서 비율대로 줄인다
                spare = [max(0, i.duration_minutes - MIN_STAY.get(i.category, 45)) for i in seg]
                over = need - max(room, 0)
                total_spare = sum(spare) or 1
                for i, sp in zip(seg, spare):
                    i.duration_minutes -= min(sp, round(over * sp / total_spare))
        t = start
        for i in seg:
            i.start_time = _hhmm(t)
            t += i.duration_minutes + BUFFER_MIN
        return t

    for item in order:
        if item.category in ("식당", "숙소"):
            cursor = place(segment, cursor, _minutes(item.start_time))
            segment = []
            cursor = max(cursor, _minutes(item.start_time)) + item.duration_minutes + BUFFER_MIN
        else:
            segment.append(item)
    place(segment, cursor, None)


def move_cafes_after_meals(plans: list[PlanOption]) -> int:
    """식사 시작 90분 안쪽으로 끝나는 카페(=식사 직전 디저트)를 앞 식사 바로 뒤로,
    앞 식사가 없으면 그 식사 바로 뒤로 옮기고 그날 시간을 다시 맞춘다."""
    moved = 0
    for plan in plans:
        for day in plan.days:
            order = sorted((i for i in day.items if i.category != "이동"), key=lambda i: i.start_time)
            changed = False
            for cafe in [i for i in order if i.category == "카페"]:
                idx = order.index(cafe)
                cafe_end = _minutes(cafe.start_time) + cafe.duration_minutes
                meal = next((i for i in order[idx + 1 :] if i.category == "식당"), None)
                if meal is None or _minutes(meal.start_time) - cafe_end >= CAFE_BEFORE_MEAL_MIN:
                    continue
                # 지치는 활동 뒤 저녁 전 애매한 시간에 음료 마시며 쉬는 카페는 자연스러우니 그대로 둔다.
                # 하루를 카페로 시작하거나, 디저트·빵처럼 배부른 카페가 식사 직전이면 옮긴다.
                heavy = any(w in f"{cafe.kakao_category} {cafe.name}" for w in HEAVY_CAFE)
                after_activity = idx > 0 and order[idx - 1].category in ("액티비티", "쇼핑", "관광지", "문화/전시", "휴식")
                if after_activity and not heavy:
                    continue
                prev_meal = next((i for i in reversed(order[:idx]) if i.category == "식당"), None)
                order.remove(cafe)
                target = prev_meal or meal
                pos = order.index(target) + 1
                if pos < len(order) and order[pos].category == "카페":
                    # 그 식사 뒤에 이미 카페가 있으면 카페를 두 번 연달아 가지 않게 이 카페는 뺀다
                    day.items = [i for i in day.items if i.id != cafe.id]
                else:
                    order.insert(pos, cafe)
                changed = True
                moved += 1
            if changed:
                first = min(_minutes(i.start_time) for i in day.items if i.category != "이동")
                _layout(order, first)
                movers = [i for i in day.items if i.category == "이동"]
                day.items = sorted(order + movers, key=lambda i: i.start_time)
    return moved


# ---------------------------------------------------------------------------
# 9) 생성 후: 상식 검사 — 식후 카페는 디저트 위주로, 실외 제외 요청 반영, 도착·출발 시각 지키기
# ---------------------------------------------------------------------------

MEAL_LIKE_CAFE = ("브런치", "샌드위치", "샐러드", "베이글", "토스트", "버거", "포케")
OUTDOOR_WORDS = ("호수", "공원", "산 ", "등산", "해수욕장", "해변", "계곡", "숲", "둘레길", "산책로", "유원지", "수목원", "광장", "올레")


def _is_meal_like_cafe(item: PlanItem) -> bool:
    text = f"{item.kakao_category} {item.name}"
    return item.category == "카페" and any(w in text for w in MEAL_LIKE_CAFE)


def _is_outdoor(item: PlanItem) -> bool:
    text = f"{item.kakao_category} "
    return item.category in ("관광지", "휴식", "액티비티", "기타") and any(w in text for w in OUTDOOR_WORDS)


def wants_indoor(rules: list[str], notes: str) -> bool:
    text = " ".join(rules) + " " + notes
    return ("실외" in text or "야외" in text) and any(w in text for w in ("빼", "제외", "싫", "말고", "않"))


async def common_sense_fixes(
    plans: list[PlanOption], spec: TripSpec, indoor_only: bool, keep: set[str] | None = None
) -> int:
    """사람들이 보통 여행하는 방식에 맞게 손본다.
    - 식사 직후 카페가 브런치·샌드위치처럼 밥 대용이면 근처 디저트 카페로 바꾼다
    - 실외 활동을 빼 달라고 했으면 호수·공원 같은 실외 장소를 근처 실내 장소로 바꾼다
    - 첫날 도착 전, 마지막 날 출발 1시간 전 이후의 일정은 뺀다 (요청 장소는 남김)"""
    key = get_settings().kakao_rest_api_key
    changed = 0
    keep = keep or set()
    exclude = {i.place_url for p in plans for d in p.days for i in d.items if i.place_url}
    async with _client(key) as client:
        tokens = await expand_region_tokens(client, region_tokens(spec.region)) if key else []
        for plan in plans:
            for day in plan.days:
                order = sorted(day.items, key=lambda i: i.start_time)
                for idx, item in enumerate(order):
                    if item.lat is None or _core(item.name) in keep or not key:
                        continue
                    after_meal = idx > 0 and order[idx - 1].category == "식당"
                    words: list[str] = []
                    reason = ""
                    if after_meal and _is_meal_like_cafe(item):
                        words, reason = ["디저트카페", "베이커리", "케이크"], "식사 바로 뒤라 밥 대신 먹는 곳보다 디저트 카페가 어울려서"
                    elif indoor_only and _is_outdoor(item):
                        words, reason = ["실내 놀거리", "전시", "쇼핑몰", "방탈출"], "실외 활동을 빼 달라고 하셔서"
                    if not words:
                        continue
                    pick = None
                    for w in words:
                        for d in await _nearby_keyword_any(client, w, item.lat, item.lng, 2000):  # type: ignore[arg-type]
                            c = _to_candidate(d)
                            if _is_facility(d) or c.place_url in exclude or not in_region(c.address, tokens):
                                continue
                            probe = PlanItem(id="p", name=c.name, category=item.category, kakao_category=c.category_path)
                            if _is_meal_like_cafe(probe) or _is_outdoor(probe):
                                continue
                            pick = c
                            break
                        if pick:
                            break
                    if pick:
                        old = item.name
                        apply_replacement(item, pick)
                        exclude.add(pick.place_url)
                        if indoor_only and item.category in ("관광지", "휴식"):
                            item.category = "액티비티" if any(k in pick.category_path for k in ("여가", "레저", "놀이", "방탈출")) else "문화/전시" if "전시" in pick.category_path else "쇼핑" if "쇼핑" in pick.category_path else item.category
                        item.reason = f"{reason} '{old}' 대신 넣었어요."
                        changed += 1

            # 도착 전·출발 직전 일정 정리
            if plan.days:
                first, last = plan.days[0], plan.days[-1]
                if spec.start_time:
                    arrive = _minutes(spec.start_time)
                    first.items = [i for i in first.items if _minutes(i.start_time) >= arrive or _core(i.name) in keep or i.category == "숙소"]
                if spec.end_time:
                    # 출발 40분 전까지는 끝낸다. 넘치는 일정은 바로 빼지 않고 머무는 시간부터 줄여 본다
                    leave = _minutes(spec.end_time) - 40
                    for i in last.items:
                        over = _minutes(i.start_time) + i.duration_minutes - leave
                        floor = MIN_STAY.get(i.category, 45)
                        if 0 < over and i.duration_minutes - over >= floor:
                            i.duration_minutes -= over
                    before = len(last.items)
                    last.items = [
                        i for i in last.items
                        if _minutes(i.start_time) + i.duration_minutes <= leave or _core(i.name) in keep or i.category == "숙소"
                    ]
                    changed += before - len(last.items)
    return changed


async def _nearby_keyword_any(client: httpx.AsyncClient, word: str, lat: float, lng: float, radius_m: int) -> list[dict]:
    params = {"x": lng, "y": lat, "radius": radius_m, "sort": "accuracy", "size": 10, "query": word}
    try:
        res = await client.get(KAKAO_KEYWORD_URL, params=params)
        return res.json().get("documents", []) if res.status_code == 200 else []
    except httpx.HTTPError:
        return []


# ---------------------------------------------------------------------------
# 10) 생성 후: 배부르게 먹은 뒤 바로 디저트 카페에 가지 않게 순서를 바꾼다
# ---------------------------------------------------------------------------

# 가볍게 먹는 식사 (먹고 바로 디저트를 먹어도 괜찮음)
LIGHT_MEAL = ("샐러드", "샌드위치", "브런치", "국수", "분식", "베이글", "포케", "쌀국수", "초밥,롤", "죽")
ACTIVE = ("액티비티", "쇼핑", "관광지", "문화/전시")


def is_light_meal(item: PlanItem) -> bool:
    return any(w in f"{item.kakao_category} {item.name}" for w in LIGHT_MEAL)


def digest_before_dessert(plans: list[PlanOption]) -> int:
    """든든한 식사 바로 뒤에 카페가 오면, 그 뒤의 구경·활동을 카페 앞으로 당긴다.
    (점심 → 쇼핑·놀거리 → 카페에서 쉬기 → 저녁: 사람들이 보통 노는 순서)"""
    moved = 0
    for plan in plans:
        for day in plan.days:
            order = sorted((i for i in day.items if i.category != "이동"), key=lambda i: i.start_time)
            changed = False
            for idx in range(len(order) - 1):
                meal, cafe = order[idx], order[idx + 1]
                if meal.category != "식당" or cafe.category != "카페" or is_light_meal(meal):
                    continue
                nxt_meal = next((j for j in range(idx + 2, len(order)) if order[j].category == "식당"), len(order))
                act = next((j for j in range(idx + 2, nxt_meal) if order[j].category in ACTIVE), None)
                if act is None:
                    continue
                activity = order.pop(act)
                order.insert(idx + 1, activity)
                changed = True
                moved += 1
            if changed:
                first = min(_minutes(i.start_time) for i in order)
                _layout(order, first)
                movers = [i for i in day.items if i.category == "이동"]
                day.items = sorted(order + movers, key=lambda i: i.start_time)
    return moved


# ---------------------------------------------------------------------------
# 11) 생성 후: 동선 다듬기 — 걸어갈 수 있는 비슷한 곳으로 바꾸고, 식사 사이 순서를 가까운 순으로
# ---------------------------------------------------------------------------

import itertools  # noqa: E402


def _route_km(points: list[PlanItem]) -> float:
    return sum(_pair_km(a, b) for a, b in zip(points, points[1:]))


def optimize_order(plans: list[PlanOption]) -> int:
    """식사(·숙소) 사이에 있는 구경·활동 장소들의 순서를 이동 거리가 가장 짧게 바꾼다.
    카페 자리(식후/휴식)는 그대로 두고 나머지만 순서를 바꾼다."""
    changed = 0
    for plan in plans:
        for day in plan.days:
            order = sorted((i for i in day.items if i.category != "이동"), key=lambda i: i.start_time)
            if any(i.lat is None for i in order):
                continue
            new_order = list(order)
            anchors = [k for k, i in enumerate(order) if i.category in ("식당", "숙소")]
            bounds = [-1, *anchors, len(order)]
            for a, b in zip(bounds, bounds[1:]):
                seg_idx = [k for k in range(a + 1, b) if order[k].category != "카페"]
                if len(seg_idx) < 2 or len(seg_idx) > 5:
                    continue
                seg = [order[k] for k in seg_idx]

                def total(perm: tuple[PlanItem, ...]) -> float:
                    trial = list(new_order)
                    for k, it in zip(seg_idx, perm):
                        trial[k] = it
                    return _route_km(trial[max(a, 0) : b + 1])

                best = min(itertools.permutations(seg), key=total)
                if list(best) != seg and total(tuple(seg)) - total(best) > 0.3:
                    for k, it in zip(seg_idx, best):
                        new_order[k] = it
                    changed += 1
            if new_order != order:
                _layout(new_order, min(_minutes(i.start_time) for i in order))
                movers = [i for i in day.items if i.category == "이동"]
                day.items = sorted(new_order + movers, key=lambda i: i.start_time)
    return changed


async def prefer_walkable(plans: list[PlanOption], spec: TripSpec, keep: set[str] | None = None, avoid: list[str] | None = None) -> int:
    """대중교통·미정 여행에서, 앞 장소에서 걸어갈 수 없는 곳은 걸어갈 수 있는 '비슷한 종류' 장소가 있으면 바꾼다.
    (예: 같은 동네 카페가 있는데 굳이 버스 타고 가는 카페) 비슷한 곳이 없으면 그대로 둔다."""
    key = get_settings().kakao_rest_api_key
    if not key or spec.transport in ("자차", "도보 위주"):
        return 0
    walk_km = WALK_KMH * spec.max_walk_minutes / 60 / DETOUR
    changed = 0
    async with _client(key) as client:
        tokens = await expand_region_tokens(client, region_tokens(spec.region))
        for plan in plans:
            used = {i.place_url for d in plan.days for i in d.items if i.place_url}
            for day in plan.days:
                items = sorted((i for i in day.items if i.lat is not None and i.category != "이동"), key=lambda i: i.start_time)
                for idx in range(1, len(items)):
                    prev, item = items[idx - 1], items[idx]
                    if item.category in ("숙소",) or _core(item.name) in (keep or set()) or _pair_km(prev, item) <= walk_km:
                        continue
                    parts = [p.strip() for p in item.kakao_category.split(">")]
                    word = parts[-1] if len(parts) >= 3 else ("카페" if item.category == "카페" else "")
                    if not word:
                        continue
                    nxt = items[idx + 1] if idx + 1 < len(items) else None
                    docs = await _nearby_keyword_any(client, word, prev.lat, prev.lng, int(walk_km * 1000))  # type: ignore[arg-type]
                    picks = [
                        c
                        for c in map(_to_candidate, docs)
                        if not _is_facility({"place_name": c.name, "category_name": c.category_path})
                        and c.place_url not in used
                        and in_region(c.address, tokens)
                        and c.x is not None
                        and not is_excluded(c.category_path, avoid)
                        and (item.category != "식당" or c.category_path.startswith("음식점") and "카페" not in c.category_path)
                        and (item.category != "카페" or "카페" in c.category_path)
                    ]
                    if nxt is not None:
                        picks.sort(key=lambda c: _km(c, nxt.lng, nxt.lat))  # type: ignore[arg-type]
                    if not picks:
                        continue
                    pick, old = picks[0], item.name
                    used.discard(item.place_url)
                    used.add(pick.place_url)
                    apply_replacement(item, pick)
                    item.reason = f"'{old}'은(는) 앞 장소에서 대중교통을 타야 해서, 걸어갈 수 있는 비슷한 곳으로 바꿨어요."
                    changed += 1
    return changed
