"""Google Gemini(google-genai SDK) 기반 여행 플래너 엔진."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import timedelta
from functools import lru_cache

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from .config import get_settings
from .mock_planner import build_mock_plan
from .schemas import (
    AIPlanOption,
    DayPlan,
    PlanItem,
    NoteRequirements,
    PlanOption,
    TravelRequest,
    TripPlanResponse,
)
from .store import new_id

logger = logging.getLogger(__name__)


PER_MODEL_TIMEOUT_SEC = 90
TOTAL_BUDGET_SEC = 150


class PlannerError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def drinking_lines(req: TravelRequest) -> list[str]:
    """참여자 음주 성향을 일정 규칙으로 바꾼다 (저녁 술자리 포함 여부, 주종, 운전자 고려)"""
    known = [p for p in req.participants if p.drinking]
    if not known:
        return []
    groups: dict[str, list[str]] = {}
    for p in known:
        groups.setdefault(p.drinking, []).append(p.nickname)
    summary = ", ".join(f"{k} {len(v)}명({', '.join(v)})" for k, v in groups.items())
    lines = [f"- 음주 성향: {summary}"]
    types = sorted({t for p in known for t in p.drink_types})
    lovers = len(groups.get("술자리 좋아요", []))
    sober = len(groups.get("안 마셔요", []))
    if lovers and lovers >= sober:
        lines.append(
            "- 저녁 일정에 술자리(이자카야·포차·와인바·브루어리 등)를 1곳 넣되, 술을 안 마시는 사람도 즐길 수 있는 메뉴가 있는 곳으로"
            + (f". 선호 주종: {', '.join(types)}" if types else "")
        )
    elif sober and sober == len(known):
        lines.append("- 모두 술을 마시지 않으니 술집·바 위주의 장소는 넣지 마세요")
    else:
        lines.append("- 술집을 일정의 중심으로 두지 말고, 저녁 식사 장소에서 가볍게 곁들일 수 있는 정도로만")
    if req.spec.transport == "자차" and (lovers or groups.get("가볍게 한두 잔")):
        lines.append("- 자차 여행이라 운전자는 마실 수 없으니 술자리는 숙소 근처나 그날의 마지막 일정으로 두세요")
    return lines


SYSTEM_INSTRUCTION = """\
당신은 한국 국내외 여행 일정을 짜는 전문 여행 플래너입니다.
규칙:
1. 반드시 실제로 존재하는 장소만 추천합니다. 확신이 없는 장소는 넣지 않습니다.
2. 참여자의 알레르기·기피 음식이 주메뉴인 식당은 절대 추천하지 않습니다.
3. 동선이 효율적이도록 같은 날의 장소는 가까운 지역끼리 묶고, 이동 시간을 고려해 start_time 을 배치합니다.
4. 식사 시간(점심 11:30~13:30, 저녁 17:30~19:30)에는 식당을 배치하고, 브레이크 타임과 겹치지 않게 합니다.
11. 시간표를 채우는 게 아니라, 실제 사람이 하루를 보내는 흐름(배고픔·체력·기분)을 상상하며 짭니다.
    장소마다 "왜 지금 이걸 하는지"가 자연스러워야 합니다.
   - 체력: 오전엔 체력이 좋으니 걷거나 몸 쓰는 활동을 두고, 액티비티·쇼핑처럼 지치는 일정 뒤에는
     카페·숙소 휴식처럼 앉아서 쉬는 일정을 둡니다. 식사 직후에는 격한 활동을 바로 넣지 않습니다.
   - 배고픔: 점심은 12시 전후, 저녁은 18~19시. 끼니 사이는 최소 4~5시간. 식당을 연달아 넣지 않습니다.
     디저트·빵·브런치처럼 배부른 곳은 식사 직전에 두지 않습니다.
   - 애매한 시간: 오후 활동이 끝났는데 저녁 먹기엔 이르면, 그 시간엔 카페에서 음료 마시며 쉬거나
     가볍게 쇼핑·산책을 합니다. 이때 카페는 휴식용(커피·음료 위주)으로 고릅니다.
   - 식후: 점심을 먹고 디저트·커피를 하러 카페에 가는 건 자연스럽습니다. 이때는 디저트카페·베이커리·
     커피 전문점처럼 후식으로 갈 곳을 고르고, 브런치·샌드위치처럼 밥이 되는 카페는 끼니 자체로 씁니다
     (그 끼니에는 식당을 따로 넣지 않음).
   - 든든하게 먹은 뒤(고기·중식·한식 정식 등)에는 바로 디저트 카페에 가지 않고, 구경·산책·쇼핑으로 소화시킨 뒤
     카페에 갑니다. 가볍게 먹었으면(샐러드·국수·브런치 등) 바로 디저트 카페로 이어도 됩니다.
   - 카페는 상황에 맞게 종류를 다양하게 고릅니다: 식후 후식엔 디저트카페·베이커리, 지친 오후엔 음료 위주의
     커피 전문점이나 뷰 카페, 테마 카페 등. 같은 날·같은 일정 안에서 비슷한 카페를 반복하지 않습니다.
   - 하루 시작을 카페·디저트로 하지 않고, 카페를 연달아 넣지 않습니다. 카페는 하루 1~2번이면 충분합니다.
   - 저녁 뒤에는 야경·산책·가벼운 술자리(원할 때) 정도로 마무리하고 21~22시쯤 숙소로 돌아갑니다.
12. 체류 시간은 현실적으로 잡습니다: 식당 60~90분, 카페 60분, 전시·박물관 90~120분, 쇼핑몰 90~120분,
    실내 놀이·체험 시설 2~3시간, 테마파크는 반나절 이상.
13. 첫날은 도착 시각 이후부터, 숙소 체크인은 15시 이후로 잡고, 마지막 날은 체크아웃(11시) 뒤 가볍게 돌다가
    출발 시각 1시간 전에는 일정을 끝냅니다. 이동이 긴 날은 장소 수를 줄입니다.
16. 동선은 '걸어서 이어지는 동네 단위'로 묶습니다. 같은 동네에 비슷한 곳이 있으면 대중교통을 타야 하는 먼 곳 대신
    걸어갈 수 있는 곳을 고르고, 지역을 옮기는 이동은 하루 1~2번(예: 오전 A동네 → 점심 후 B동네)으로 줄입니다.
    하루 동선은 한 방향으로 이어지게 순서를 정하고 왔던 곳으로 되돌아가지 않습니다
    (예: 범계 → 사당 → 동대문 순서로 가지, 범계 → 동대문 → 사당처럼 지나쳤다 돌아오지 않음).
    점심·저녁 식당도 그 흐름 위(지나가는 동네)에서 고릅니다.
15. 누가 가는지(연령대·성별 구성·인원·테마·참여자 취향)를 먼저 떠올리고, 그 사람들이 실제로 좋아할 루틴으로 짭니다.
    동선 위나 근처에 그 사람들이 그냥 지나치지 않을 곳(백화점·쇼핑몰, 소품샵·편집샵 거리, 포토스팟, 시장 등)이 있으면
    짧게라도 구경하는 일정을 넣습니다. 아래 [여행자 성향]을 참고하세요.
14. 계절·날씨를 고려합니다. 한겨울·한여름이나 사용자가 추위·더위를 피하고 싶다고 하면 실외 일정은 넣지 않거나 짧게 둡니다.
5. 영업시간·브레이크 타임·휴무일은 알려진 정보만 적고, 모르면 빈 문자열/빈 배열로 둡니다. 추측하지 않습니다.
6. main_plan(1안)은 조건에 가장 충실한 알찬 일정, alternative_plan(2안)은 하루 장소 수를 줄인 여유로운 일정이거나
   다른 동선/테마를 탐색하는 대체 일정으로, 1안과 겹치는 장소를 최소화합니다.
7. 모든 텍스트는 자연스러운 한국어로 작성합니다.
8. 상호명은 지도 앱에 등록된 정확한 이름(지점명 포함)으로 적습니다. 이름을 지어내거나 비슷하게 바꾸지 않습니다.
   잘 모르는 지역이면 오래 영업한 유명 식당·명소 위주로 고릅니다.
9. parking / parking_note 는 해당 장소(또는 입점한 건물)의 주차 정보를 확실히 알 때만 채우고, 모르면 '모름'과 빈 문자열로 둡니다.
10. on_catchtable / on_naver_booking 은 해당 플랫폼 예약이 가능하다고 확실히 아는 경우에만 true 로 하고, 애매하면 false 로 둡니다.
"""


NOTES_INSTRUCTION = """\
여행자가 남긴 요청 메모를 일정 생성 규칙으로 정리합니다.
- must_visit: 이름이 나온 특정 가게·장소만 (예: '스타필드 스몹', '갓잇 송리단길점'). '카페', '고기', '베이커리' 같은 일반 명사는 넣지 않습니다.
  name 에는 사용자가 쓴 이름에서 '하남 스타필드' 같은 위치 수식어를 뺀 상호명만 적습니다 (예: '스몹').
- day_areas: '1일차는 하남' 처럼 날짜별로 노는 지역이 정해져 있으면 적습니다.
- rules: 나머지 요구사항을 빠짐없이, 한 줄에 하나씩 짧은 명령문으로 적습니다.
  (식사 조건, 매일 꼭 갈 곳 종류, 빼야 할 활동, 숙소 위치 계획 등)
"""


async def parse_notes(notes: str) -> NoteRequirements:
    """추가 요청 메모를 구조화한다. AI 를 못 쓰면 빈 결과(기존 방식으로 처리)."""
    settings = get_settings()
    if not notes.strip() or not settings.gemini_api_key:
        return NoteRequirements()
    config = types.GenerateContentConfig(
        system_instruction=NOTES_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=NoteRequirements,
        temperature=0,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    for model in dict.fromkeys([settings.gemini_model, *settings.gemini_fallback_models]):
        try:
            res = await asyncio.wait_for(
                get_client().aio.models.generate_content(model=model, contents=notes, config=config), timeout=25
            )
            parsed = res.parsed if isinstance(res.parsed, NoteRequirements) else NoteRequirements.model_validate_json(res.text or "{}")
            logger.info("추가 요청 분석: %s", parsed.model_dump())
            return parsed
        except (asyncio.TimeoutError, genai_errors.APIError, ValueError) as exc:
            logger.warning("추가 요청 분석 실패(%s): %s", model, str(exc)[:120])
    return NoteRequirements()


def requirements_prompt(reqs: NoteRequirements, spec=None) -> str:
    """사용자 요청을 프롬프트 맨 앞에 '반드시 지킬 것' 체크리스트로 둔다."""
    lines: list[str] = []
    for m in getattr(spec, "must_visits", []) or []:
        when = " ".join(x for x in [f"{m.day}일차" if m.day else "", m.slot] if x)
        lines.append(f"- '{m.name}'({m.address or '주소 미상'})을(를) {when + '에 ' if when else ''}1안·2안 모두에 반드시 넣습니다")
    for d in sorted(reqs.day_areas, key=lambda d: d.day):
        lines.append(f"- {d.day}일차는 {d.area} 지역에서만 일정을 짭니다")
    for m in reqs.must_visit:
        when = " ".join(x for x in [f"{m.day}일차" if m.day else "", m.slot] if x)
        lines.append(f"- '{m.name}'을(를) {when + '에 ' if when else ''}1안·2안 모두에 반드시 넣습니다")
    lines += [f"- {r}" for r in reqs.rules]
    if not lines:
        return ""
    return (
        "[사용자 요청 — 아래 항목은 다른 어떤 조건보다 우선합니다. 1안·2안 모두 하나도 빠짐없이 지키세요]\n"
        + "\n".join(lines)
        + "\n일정을 다 짠 뒤 위 항목을 하나씩 다시 확인하고, 어긋나면 고친 다음 답하세요.\n\n"
    )


BUDGET_RULES = {
    "알뜰": "1인 기준 식사 1만 원대, 카페 음료 5천 원 안팎의 가성비 좋은 곳 위주로 고르세요. 호텔 레스토랑·라운지, 파인다이닝, 고가 뷔페는 넣지 마세요.",
    "보통": "1인 기준 식사 1~3만 원, 카페 음료·디저트 1만 원 안팎의 일반적인 가격대로 고르세요. "
    "호텔 라운지·호텔 레스토랑·고급 뷔페·파인다이닝처럼 1인 5만 원이 넘는 곳은 사용자가 직접 요청하지 않았다면 넣지 마세요.",
    "여유": "가격보다 경험을 우선해 호텔 레스토랑·파인다이닝·오마카세 같은 곳도 넣어도 됩니다.",
}


def persona_lines(spec) -> list[str]:
    """연령·성별·인원·테마로 '이런 사람들은 보통 이렇게 논다'를 구체적으로 알려준다."""
    ages = set(spec.age_groups)
    young = bool(ages & {"20대", "30대"})
    lines: list[str] = []
    if spec.gender_mix == "여성만" and young:
        lines.append("젊은 여성 일행: 구경을 좋아합니다. 백화점·쇼핑몰·소품샵·편집샵 거리, 감성 카페, 포토스팟을 동선에 넣고, 사진 찍기 좋은 곳을 고르세요.")
    elif spec.gender_mix == "남성만" and young:
        lines.append("젊은 남성 일행: 몸으로 노는 액티비티(실내 스포츠·게임·방탈출 등)와 양 많은 맛집, 저녁 뒤 술자리(원할 때)를 좋아합니다.")
    elif young:
        lines.append("20~30대 일행: 맛집·카페와 함께 쇼핑·소품샵 구경, 포토스팟, 가벼운 체험을 섞어 지루하지 않게 짜세요.")
    if "10대" in ages:
        lines.append("10대가 있음: 체험·놀거리 위주로, 너무 조용하거나 어른 취향인 곳(바·와인바 등)은 피하세요.")
    if "영유아" in ages:
        lines.append("영유아 동반: 하루 3~4곳만, 낮잠·수유를 고려해 오후에 숙소나 카페 휴식을 넣고, 키즈존·유모차 이동이 편한 곳을 고르세요. 술집은 넣지 마세요.")
    if ages & {"50대", "60대 이상"}:
        lines.append("50대 이상이 있음: 많이 걷지 않게 하고, 계단·오르막이 적은 곳, 앉아서 쉬는 시간을 충분히 넣으세요. 너무 시끄러운 곳은 피하세요.")
    if spec.headcount and spec.headcount >= 6:
        lines.append(f"{spec.headcount}명 단체: 단체 좌석이 있는 넓은 식당·카페를 고르고, 예약을 권하세요.")
    if not lines:
        return ""
    return "[여행자 성향]\n" + "\n".join(f"- {l}" for l in lines) + "\n"


def budget_rule(level: str) -> str:
    return f"[예산 규칙 — {level}] {BUDGET_RULES.get(level, BUDGET_RULES['보통'])}\n"


def _describe_request(req: TravelRequest) -> str:
    spec = req.spec.normalized()
    if spec.duration_mode == "exact" and spec.start_date:
        period = f"{spec.start_date.isoformat()} ~ {spec.end_date.isoformat() if spec.end_date else spec.start_date.isoformat()}"
        period += f" ({spec.nights}박 {spec.days}일)"
        if spec.start_time:
            period += f", 첫날 {spec.start_time} 도착"
        if spec.end_time:
            period += f", 마지막 날 {spec.end_time} 출발"
    else:
        period = f"{spec.nights}박 {spec.days}일 (날짜 미정)"

    headcount = "미정" if spec.headcount_undecided or not spec.headcount else f"{spec.headcount}명"
    lines = [
        f"- 여행 지역: {spec.region}",
        f"- 기간: {period}",
        f"- 인원: {headcount}, 성별 구성: {spec.gender_mix}",
        f"- 연령대: {', '.join(spec.age_groups) or '미정'}",
        f"- 여행 테마: {', '.join(spec.themes) or '자유'}",
        f"- 예산 수준: {spec.budget_level}",
        f"- 이동 수단: {spec.transport} (장소 간 최대 이동 {spec.max_travel_minutes}분)",
    ]
    if spec.excluded_cuisines:
        lines.append(f"- 넣지 말아야 할 음식 종류(식당으로 절대 넣지 않음): {', '.join(spec.excluded_cuisines)}")
    if spec.notes:
        lines.append(f"- 추가 요청: {spec.notes}")

    allergies = sorted({a for p in req.participants for a in p.allergies})
    dislikes = sorted({d for p in req.participants for d in p.dislikes})
    tags = sorted({t for p in req.participants for t in p.preferred_tags})
    if allergies:
        lines.append(f"- 알레르기 식재료(절대 제외): {', '.join(allergies)}")
    if dislikes:
        lines.append(f"- 기피 음식(가급적 제외): {', '.join(dislikes)}")
    if tags:
        lines.append(f"- 참여자 선호 태그: {', '.join(tags)}")
    lines += drinking_lines(req)

    return (
        "아래 조건으로 여행 일정 1안과 2안을 만들어 주세요.\n"
        + "\n".join(lines)
        + f"\n\n각 플랜의 days 는 정확히 {spec.days}개(day 1 ~ {spec.days})여야 하고, "
        "하루에 4~7곳(2안은 3~5곳)을 시간순으로 배치하세요. 하루 종일 일정이면 점심·저녁 식당을 각각 넣고, "
        "같은 종류(예: 카페)를 하루에 두 곳 넘게 넣지 마세요. "
        "카페·디저트는 식사 뒤(점심 후 오후 시간)에 두고, 식사 시작 1시간 30분 전 안쪽에는 넣지 마세요. "
        "아침 첫 일정을 카페로 하지 말고 점심 전 오전에는 관람·체험 같은 활동을 두세요. "
        "앞 장소가 끝난 뒤 다음 장소가 시작하기까지 이동 시간 말고 30분 넘게 비우지 마세요"
        " (비는 시간이 생기면 체류 시간을 늘리거나 근처 장소를 하나 더 넣으세요).\n"
        + budget_rule(spec.budget_level)
        + persona_lines(spec)
        + transport_rule(spec)
    )


def transport_rule(spec) -> str:
    """이동 수단 + 장소 간 최대 이동 시간 설정을 AI 가 지켜야 할 동선 규칙으로 바꾼다."""
    m = spec.max_travel_minutes
    common = (
        f"연속한 두 장소 사이 이동 시간은 반드시 {m}분 이내여야 합니다. 이를 넘는 장소는 아무리 유명해도 넣지 마세요. "
        "이동 시간을 고려해 앞 장소의 종료 시각과 다음 장소 start_time 사이에 여유를 두세요."
    )
    if spec.transport == "도보 위주":
        return (
            f"[동선 규칙 — 도보 위주] 걸어서만 이동합니다. {common} "
            f"도보 {m}분은 실제 길로 약 {m * 65}m, 지도상 직선으로는 약 {m * 50}m 입니다. 이보다 먼 두 곳을 연달아 넣지 마세요. "
            "하루에 한 동네(한 동 또는 한 상권)만 다니고, 버스·지하철·택시 이동이 필요한 장소는 넣지 마세요."
        )
    if spec.transport == "대중교통":
        return (
            f"[동선 규칙 — 대중교통/뚜벅이] 차가 없어 도보·버스·지하철로만 이동합니다. {common} "
            f"걸어서 가는 구간은 도보 {spec.max_walk_minutes}분(직선 약 {spec.max_walk_minutes * 50}m) 이내여야 하고, "
            "그보다 먼 구간은 대중교통으로 이동한다고 보고 위의 최대 시간을 지키세요. "
            "하루 일정은 인접한 1~2개 동(상권) 안에서 끝내고, 대중교통으로 가기 어려운 외곽 명소는 넣지 마세요."
        )
    if spec.transport == "자차":
        return f"[동선 규칙 — 자차] 차로 이동합니다. {common} 주차가 가능한 곳을 우선하세요."
    return f"[동선 규칙] {common} 하루 일정은 가까운 지역끼리 묶으세요."


@lru_cache
def get_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


async def generate_trip_plan(req: TravelRequest, extra_context: str = "", priority: str = "") -> tuple[TripPlanResponse, str]:
    """TripPlanResponse 와 생성 출처("gemini" | "mock")를 반환한다.

    extra_context: 카카오에서 수집한 실제 장소 후보 목록 등 프롬프트에 덧붙일 내용
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        if settings.allow_mock_fallback:
            logger.warning("GEMINI_API_KEY 가 없어 목업 플랜을 반환합니다.")
            return build_mock_plan(req), "mock"
        raise PlannerError("GEMINI_API_KEY 가 설정되지 않았습니다.", 503)

    client = get_client()
    contents = priority + _describe_request(req) + extra_context
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=TripPlanResponse,
        temperature=0.7,
        # 함수 호출을 쓰지 않으므로 AFC 를 끈다 (불필요한 경고 로그 제거)
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    # 기본 모델이 과부하(503)·제공 종료(404)·모델별 한도 초과(429)·시간 초과면 대체 모델을 순서대로 시도한다.
    # 전체 소요 시간은 프론트 프록시 제한(180초)보다 짧게 유지해, 끊기기 전에 이유가 담긴 오류를 돌려준다.
    models = list(dict.fromkeys([settings.gemini_model, *settings.gemini_fallback_models]))
    deadline = time.monotonic() + TOTAL_BUDGET_SEC
    last_error: Exception | None = None
    response = None
    # 과부하는 수 초 단위로 풀리는 경우가 많아, 전부 실패하면 잠시 쉬었다가 한 바퀴 더 돈다
    attempts = [(model, 0.0) for model in models] + [(model, 3.0 if i == 0 else 0.0) for i, model in enumerate(models)]
    for model, pause in attempts:
        if pause:
            await asyncio.sleep(pause)
        remaining = deadline - time.monotonic()
        if remaining < 15:
            break
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(model=model, contents=contents, config=config),
                timeout=min(PER_MODEL_TIMEOUT_SEC, remaining),
            )
            logger.info("AI 플랜 생성 모델: %s", model)
            break
        except asyncio.TimeoutError as exc:
            last_error = exc
            logger.warning("모델 %s 응답 시간 초과, 다음 모델로 재시도", model)
        except genai_errors.APIError as exc:
            last_error = exc
            if exc.code in (404, 429, 500, 503, 504):
                logger.warning("모델 %s 실패(%s), 다음 모델로 재시도: %s", model, exc.code, (exc.message or "")[:120])
                continue
            raise PlannerError(f"AI 요청이 거부되었습니다: {exc.message or exc.code}", 502) from exc

    if response is None:
        if isinstance(last_error, genai_errors.APIError) and last_error.code == 429:
            raise PlannerError("AI 무료 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.", 429) from last_error
        if isinstance(last_error, asyncio.TimeoutError) or last_error is None:
            raise PlannerError("AI 응답이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.", 504) from last_error
        raise PlannerError("AI 서버가 일시적으로 붐벼요. 잠시 후 다시 시도해 주세요.", 503) from last_error

    parsed = response.parsed
    if isinstance(parsed, TripPlanResponse):
        return parsed, "gemini"
    # SDK 가 parsed 를 채우지 못한 경우(드묾) 텍스트를 직접 검증
    try:
        return TripPlanResponse.model_validate(json.loads(response.text or "")), "gemini"
    except (ValueError, TypeError) as exc:
        raise PlannerError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.", 502) from exc


def to_plan_options(result: TripPlanResponse, req: TravelRequest) -> list[PlanOption]:
    """AI 응답을 협업용 저장 모델로 변환한다(아이템 id, 날짜 부여)."""
    spec = req.spec.normalized()

    def convert(option: AIPlanOption, plan_id: str, label: str) -> PlanOption:
        days: list[DayPlan] = []
        for idx, day in enumerate(sorted(option.days, key=lambda d: d.day)[: spec.days], start=1):
            date_str = None
            if spec.duration_mode == "exact" and spec.start_date:
                date_str = (spec.start_date + timedelta(days=idx - 1)).isoformat()
            items = [
                PlanItem(id=new_id(), **place.model_dump())
                for place in sorted(day.places, key=lambda p: p.start_time)
            ]
            days.append(DayPlan(day=idx, date=date_str, title=day.title, items=items))
        return PlanOption(id=plan_id, label=label, title=option.title, concept=option.concept, days=days)

    return [
        convert(result.main_plan, "A", "1안"),
        convert(result.alternative_plan, "B", "2안"),
    ]
