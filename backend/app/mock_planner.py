"""GEMINI_API_KEY 가 없을 때 UI 개발/데모용으로 쓰는 목업 플랜 생성기.

실제 장소가 아니므로 이름 앞에 [예시] 를 붙인다.
"""

from __future__ import annotations

from .schemas import AIDayPlan, AIPlace, AIPlanOption, TravelRequest, TripPlanResponse

_MAIN_SLOTS = [
    ("09:30", 90, "관광지", "대표 명소", "도착 후 가볍게 둘러보기 좋은 대표 명소예요."),
    ("11:40", 70, "식당", "로컬 맛집", "현지인이 즐겨 찾는 점심 식당이에요."),
    ("13:20", 60, "카페", "뷰 카페", "점심 후 쉬어가기 좋은 전망 카페예요."),
    ("14:40", 120, "액티비티", "체험 코스", "그룹이 함께 즐길 수 있는 체험 코스예요."),
    ("17:50", 90, "식당", "저녁 식당", "하루를 마무리하는 저녁 식사 장소예요."),
    ("19:40", 80, "관광지", "야경 스팟", "노을과 야경을 함께 볼 수 있는 곳이에요."),
]
_ALT_SLOTS = [
    ("10:30", 90, "휴식", "산책로", "느긋하게 걷기 좋은 산책 코스예요."),
    ("12:30", 80, "식당", "브런치 식당", "여유로운 늦은 점심을 위한 식당이에요."),
    ("14:30", 120, "문화/전시", "전시관", "실내에서 편하게 즐기는 전시 공간이에요."),
    ("18:00", 100, "식당", "분위기 좋은 저녁", "대화 나누기 좋은 조용한 저녁 식당이에요."),
]


def _place(region: str, day: int, slot: tuple[str, int, str, str, str]) -> AIPlace:
    start, duration, category, label, reason = slot
    is_food = category in ("식당", "카페")
    return AIPlace(
        name=f"[예시] {region} {label} {day}",
        category=category,  # type: ignore[arg-type]
        start_time=start,
        duration_minutes=duration,
        reason=reason,
        area=f"{region} 중심가",
        search_keyword=f"{region} {label}",
        open_time="10:00" if is_food else "09:00",
        close_time="21:00" if is_food else "18:00",
        break_start="15:00" if category == "식당" else "",
        break_end="17:00" if category == "식당" else "",
        closed_days=["월"] if category == "식당" else [],
        reservation_recommended=category == "식당",
        on_catchtable=False,
        on_naver_booking=False,
        parking="모름",
        parking_note="",
        tip="AI API 키를 설정하면 실제 장소로 추천받을 수 있어요.",
    )


def build_mock_plan(req: TravelRequest) -> TripPlanResponse:
    spec = req.spec.normalized()
    region = spec.region
    themes = ", ".join(spec.themes) or "자유 여행"

    def option(title: str, concept: str, slots: list) -> AIPlanOption:
        return AIPlanOption(
            title=title,
            concept=concept,
            days=[
                AIDayPlan(day=d, title=f"{d}일차 · {region} 둘러보기", places=[_place(region, d, s) for s in slots])
                for d in range(1, spec.days + 1)
            ],
        )

    return TripPlanResponse(
        main_plan=option(f"{region} 알찬 {themes} 코스", "핵심 명소와 맛집을 촘촘하게 담은 메인 일정이에요.", _MAIN_SLOTS),
        alternative_plan=option(f"{region} 여유로운 힐링 코스", "하루 일정을 줄여 쉬어가는 대체 일정이에요.", _ALT_SLOTS),
    )
