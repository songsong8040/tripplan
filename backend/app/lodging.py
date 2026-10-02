"""여행 조건의 예약 숙소(여러 개 가능)를 일정에 자동으로 끼워 넣는다.

숙소마다 묵는 밤(nights: 1 = 1일차 밤)을 지정한다. N일차 기준:
- 아침(2일차~): 전날 밤 숙소에서 출발. 오늘 밤 숙소가 다르거나 마지막 날이면 '체크아웃', 같으면 '숙소 출발'
- 저녁(마지막 날 전): 오늘 밤 숙소로 이동. 전날 밤 숙소와 다르면 '체크인', 같으면 '숙소 복귀'
- 숙소가 지정되지 않은 밤은 건너뛴다
자동 생성 항목은 lodging=True 로 표시해, 숙소를 바꾸면 다시 만든다.
"""

from __future__ import annotations

from .schemas import DayPlan, Lodging, PlanItem, PlanOption, TripSpec
from .store import new_id

LEAVE_BEFORE_MIN = 30  # 첫 일정보다 이만큼 먼저 숙소를 나선다


def _to_min(hhmm: str) -> int | None:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _to_hhmm(total: int) -> str:
    total = max(0, min(total, 23 * 60 + 59))
    return f"{total // 60:02d}:{total % 60:02d}"


def _lodging_item(lodging: Lodging, start: int, action: str, reason: str) -> PlanItem:
    parts = lodging.address.split()
    return PlanItem(
        id=new_id(),
        name=lodging.name,
        category="숙소",
        start_time=_to_hhmm(start),
        duration_minutes=0,
        reason=reason,
        area=parts[2] if len(parts) > 2 else "",
        search_keyword=" ".join([*parts[:2], lodging.name]),
        address=lodging.address,
        place_url=lodging.place_url,
        lat=lodging.lat,
        lng=lodging.lng,
        verified=True if lodging.lat is not None else None,
        lodging=True,
        memo=action,
    )


def _day_start(day: DayPlan) -> int | None:
    starts = [s for i in day.items if not i.lodging and (s := _to_min(i.start_time)) is not None]
    return min(starts) if starts else None


def _day_end(day: DayPlan) -> int | None:
    ends = [s + i.duration_minutes for i in day.items if not i.lodging and (s := _to_min(i.start_time)) is not None]
    return max(ends) if ends else None


def inject_lodging(plans: list[PlanOption], spec: TripSpec | None) -> None:
    """plans 를 제자리에서 수정한다. 기존 자동 숙소 항목은 지우고 현재 숙소들로 다시 만든다."""
    for plan in plans:
        for day in plan.days:
            day.items = [i for i in day.items if not i.lodging]

    if not spec or not spec.lodgings:
        return
    spec = spec.normalized()
    if spec.nights < 1:
        return
    last_day = spec.days

    def stay(night: int) -> tuple[int, Lodging] | None:
        return spec.lodging_for_night(night) if 1 <= night <= spec.nights else None

    for plan in plans:
        for day in plan.days:
            prev, tonight = stay(day.day - 1), stay(day.day)

            # 아침: 전날 밤 숙소에서 출발
            if prev:
                idx, lodging = prev
                first = _day_start(day)
                leave = (first - LEAVE_BEFORE_MIN) if first is not None else 9 * 60
                moving = day.day == last_day or not tonight or tonight[0] != idx
                if moving:
                    check_out = _to_min(lodging.check_out) or 11 * 60
                    leave = min(leave, check_out)
                    item = _lodging_item(lodging, leave, "체크아웃", f"체크아웃 {lodging.check_out}까지 · 짐 챙기는 것 잊지 마세요.")
                else:
                    item = _lodging_item(lodging, leave, "숙소 출발", "숙소에서 하루를 시작해요.")
                day.items.insert(0, item)

            # 저녁: 오늘 밤 숙소로 이동
            if tonight and day.day < last_day:
                idx, lodging = tonight
                end = _day_end(day)
                back = end if end is not None else (_to_min(lodging.check_in) or 15 * 60)
                if not prev or prev[0] != idx:
                    back = max(back, _to_min(lodging.check_in) or 15 * 60)
                    item = _lodging_item(lodging, back, "체크인", f"체크인 {lodging.check_in}부터 · 오늘 밤 묵을 숙소예요.")
                else:
                    item = _lodging_item(lodging, back, "숙소 복귀", "하루 일정을 마치고 숙소로 돌아가요.")
                day.items.append(item)


def lodging_prompt(spec: TripSpec) -> str:
    """AI 에게 밤별 숙소 위치를 알려 숙소 중심의 동선을 짜게 한다."""
    spec = spec.normalized()
    if not spec.lodgings or spec.nights < 1:
        return ""
    lines = []
    for night in range(1, spec.nights + 1):
        found = spec.lodging_for_night(night)
        if found:
            _, lodging = found
            where = f" ({lodging.address})" if lodging.address else ""
            lines.append(f"- {night}일차 밤: {lodging.name}{where}, 체크인 {lodging.check_in} / 체크아웃 {lodging.check_out}")
    if not lines:
        return ""
    return (
        "\n\n[예약한 숙소]\n" + "\n".join(lines) + "\n"
        "N일차 일정은 전날 밤 숙소에서 출발해 그날 밤 숙소로 끝나는 동선으로 짜세요. "
        "숙소가 바뀌는 날은 두 숙소 사이 방향으로 이동하며 들를 곳을 고르세요. "
        "숙소 체크인·출발 항목은 시스템이 자동으로 넣으니 places 에 숙소는 넣지 마세요."
    )


def lodging_centers(spec: TripSpec) -> list[tuple[float, float]]:
    """좌표가 있는 숙소들의 (위도, 경도)"""
    return [(l.lat, l.lng) for l in spec.lodgings if l.lat is not None and l.lng is not None]
