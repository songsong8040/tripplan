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
from .schemas import NearbyParking, PlanItem, PlanOption, TripSpec

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
    requested: bool = False  # 사용자가 추가 요청에서 직접 언급한 장소


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
        for doc in await _search(client, f"{spec.region} {word}"):
            if _is_facility(doc):
                continue
            c = _to_candidate(doc)
            if _normalize(word) in _normalize(c.name) and in_region(c.address, tokens):
                c.requested = True
                found.append(c)
                break
    return found


async def collect_candidates(spec: TripSpec) -> list[Candidate]:
    key = get_settings().kakao_rest_api_key
    if not key:
        return []
    region = spec.region.strip()
    tokens = region_tokens(region)
    words = list(dict.fromkeys([*BASE_QUERIES, *(q for t in spec.themes for q in THEME_QUERIES.get(t, []))]))
    queries = [(f"{region} {w}", 1) for w in words] + [(f"{region} 맛집", 2)]

    sem = asyncio.Semaphore(CONCURRENCY)

    async def run(query: str, page: int) -> list[dict]:
        async with sem:
            return await _search(client, query, page)

    async with _client(key) as client:
        requested, results = await asyncio.gather(
            _requested_places(client, spec, tokens), asyncio.gather(*(run(q, p) for q, p in queries))
        )

    seen: set[str] = {c.place_url for c in requested}
    candidates: list[Candidate] = []
    # 검색어별 결과를 번갈아 담아 특정 카테고리에 쏠리지 않게 한다
    for rank in range(15):
        for docs in results:
            if rank < len(docs) and not _is_facility(docs[rank]):
                c = _to_candidate(docs[rank])
                if c.name and c.place_url not in seen and in_region(c.address, tokens):
                    seen.add(c.place_url)
                    candidates.append(c)
    before = len(candidates)
    # 사용자가 요청한 장소도 중심 좌표 계산에 포함하되, 반경 필터와 개수 제한에서는 항상 살린다
    centers = [(l.lat, l.lng) for l in spec.lodgings if l.lat is not None and l.lng is not None]
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
        mark = "★사용자 요청(반드시 포함) | " if c.requested else ""
        return f"- {mark}{c.name} | {c.category} | {c.dong or '-'} | {c.address}{dist}"

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


async def find_replacements(
    requests: list[tuple[PlanItem, tuple[float, float]]], region: str, exclude_urls: set[str]
) -> dict[str, Candidate]:
    """(확인 안 된 아이템, 기준 좌표) 목록을 받아 아이템 id → 근처 실제 장소 후보를 돌려준다."""
    key = get_settings().kakao_rest_api_key
    if not key or not requests:
        return {}
    tokens = region_tokens(region)
    used = set(exclude_urls)
    out: dict[str, Candidate] = {}
    async with _client(key) as client:
        for item, (lat, lng) in requests:  # 순서대로 처리해 같은 장소가 중복 배정되지 않게 한다
            for radius in (1000, 3000):
                docs = [
                    d
                    for d in await _nearby(client, item.category, lat, lng, radius)
                    if not _is_facility(d)
                    # 식사 자리에 아이스크림·디저트 같은 간식류가 들어가지 않게 한다
                    and not (item.category == "식당" and "> 간식" in (d.get("category_name") or ""))
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

    tokens = region_tokens(region)
    by_name = {_normalize(c.name): c for c in candidates or []}
    sem = asyncio.Semaphore(CONCURRENCY)
    async with _client(key) as client:
        results = await asyncio.gather(*(_verify_item(client, sem, item, region, tokens, by_name) for item in items))

    matched = sum(1 for r in results if r)
    logger.info("카카오 장소 검증: %d/%d 확인", matched, len(items))
    if matched == 0 and len(items) > 1:
        # 한 곳도 못 찾으면 해외 여행이거나 키/쿼터 문제 → 검증 결과를 표시하지 않는다
        for item in items:
            item.verified = None
