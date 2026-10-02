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


SYSTEM_INSTRUCTION = """\
당신은 한국 국내외 여행 일정을 짜는 전문 여행 플래너입니다.
규칙:
1. 반드시 실제로 존재하는 장소만 추천합니다. 확신이 없는 장소는 넣지 않습니다.
2. 참여자의 알레르기·기피 음식이 주메뉴인 식당은 절대 추천하지 않습니다.
3. 동선이 효율적이도록 같은 날의 장소는 가까운 지역끼리 묶고, 이동 시간을 고려해 start_time 을 배치합니다.
4. 식사 시간(점심 11:30~13:30, 저녁 17:30~19:30)에는 식당을 배치하고, 브레이크 타임과 겹치지 않게 합니다.
5. 영업시간·브레이크 타임·휴무일은 알려진 정보만 적고, 모르면 빈 문자열/빈 배열로 둡니다. 추측하지 않습니다.
6. main_plan(1안)은 조건에 가장 충실한 알찬 일정, alternative_plan(2안)은 하루 장소 수를 줄인 여유로운 일정이거나
   다른 동선/테마를 탐색하는 대체 일정으로, 1안과 겹치는 장소를 최소화합니다.
7. 모든 텍스트는 자연스러운 한국어로 작성합니다.
8. 상호명은 지도 앱에 등록된 정확한 이름(지점명 포함)으로 적습니다. 이름을 지어내거나 비슷하게 바꾸지 않습니다.
   잘 모르는 지역이면 오래 영업한 유명 식당·명소 위주로 고릅니다.
9. parking / parking_note 는 해당 장소(또는 입점한 건물)의 주차 정보를 확실히 알 때만 채우고, 모르면 '모름'과 빈 문자열로 둡니다.
10. on_catchtable / on_naver_booking 은 해당 플랫폼 예약이 가능하다고 확실히 아는 경우에만 true 로 하고, 애매하면 false 로 둡니다.
"""


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

    return (
        "아래 조건으로 여행 일정 1안과 2안을 만들어 주세요.\n"
        + "\n".join(lines)
        + f"\n\n각 플랜의 days 는 정확히 {spec.days}개(day 1 ~ {spec.days})여야 하고, "
        "하루에 4~7곳(2안은 3~5곳)을 시간순으로 배치하세요.\n"
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
            "하루에 한 동네(한 동 또는 한 상권)만 다니고, 버스·지하철·택시 이동이 필요한 장소는 넣지 마세요."
        )
    if spec.transport == "대중교통":
        return (
            f"[동선 규칙 — 대중교통/뚜벅이] 차가 없어 도보·버스·지하철로만 이동합니다. {common} "
            "하루 일정은 인접한 1~2개 동(상권) 안에서 끝내고, 대중교통으로 가기 어려운 외곽 명소는 넣지 마세요."
        )
    if spec.transport == "자차":
        return f"[동선 규칙 — 자차] 차로 이동합니다. {common} 주차가 가능한 곳을 우선하세요."
    return f"[동선 규칙] {common} 하루 일정은 가까운 지역끼리 묶으세요."


@lru_cache
def get_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


async def generate_trip_plan(req: TravelRequest, extra_context: str = "") -> tuple[TripPlanResponse, str]:
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
    contents = _describe_request(req) + extra_context
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
