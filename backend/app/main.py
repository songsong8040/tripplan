"""TripPlan FastAPI 앱.

실행: uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .planner import PlannerError, generate_trip_plan, to_plan_options
from .lodging import inject_lodging, lodging_prompt
from .routing import LegResult, RouteRequest, route_legs
from .place_verifier import (
    apply_replacement,
    attach_parking,
    candidates_prompt,
    collect_candidates,
    find_replacements,
    search_kakao_places,
    verify_items,
    verify_plans,
)
from .schemas import (
    Comment,
    CommentCreate,
    CommentPatch,
    DayPlan,
    HistoryEntry,
    ItemCreate,
    ItemPatch,
    JoinRequest,
    JoinResponse,
    ParticipantPreference,
    ParticipantPublic,
    ParticipantRecord,
    PlanItem,
    PreferencesUpdate,
    ReorderRequest,
    TravelRequest,
    TripCreated,
    TripPlanResponse,
    TripPublic,
    TripSpec,
    TripState,
    VoteRequest,
)
from .security import hash_pin, hash_token, new_token, verify_pin
from .store import TripNotFound, TripStore, log, new_id, now_iso

logging.basicConfig(level=logging.INFO)

settings = get_settings()
store = TripStore(settings.database_path)

app = FastAPI(title="TripPlan API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("tripplan")


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    """예상 못 한 오류도 이유가 담긴 JSON 으로 돌려준다(프론트 토스트가 비지 않도록)."""
    logger.exception("처리되지 않은 오류: %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"서버 오류가 발생했어요 ({type(exc).__name__}). 잠시 후 다시 시도해 주세요."})


PARTICIPANT_COLORS =["#4f8262", "#bf6344", "#5b7bb5", "#b58a3c", "#8a5bb5", "#3c9aa0", "#b55b86", "#6b7280"]
MAX_PIN_FAILURES = 5
LOCK_MINUTES = 5


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------


def to_public(trip: TripState) -> TripPublic:
    return TripPublic(
        **trip.model_dump(exclude={"participants"}),
        participants=[ParticipantPublic(**p.model_dump()) for p in trip.participants],
    )


def get_trip_or_404(trip_id: str) -> TripState:
    try:
        return store.get(trip_id)
    except TripNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "여행 방을 찾을 수 없어요.")


def find_participant(trip: TripState, token: str | None) -> ParticipantRecord:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "먼저 닉네임과 PIN으로 참여해 주세요.")
    token_hash = hash_token(token)
    for p in trip.participants:
        if token_hash in p.token_hashes:
            return p
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "참여 정보가 만료되었어요. 다시 참여해 주세요.")


def mutate(trip_id: str, token: str | None, fn):
    """인증된 참여자로서 방 상태를 변경한다. fn(trip, participant) -> result"""

    def run(trip: TripState):
        actor = find_participant(trip, token)
        return fn(trip, actor)

    try:
        return store.mutate(trip_id, run)
    except TripNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "여행 방을 찾을 수 없어요.")


def find_item(trip: TripState, item_id: str) -> tuple[DayPlan, PlanItem]:
    for plan in trip.plans:
        for day in plan.days:
            for item in day.items:
                if item.id == item_id:
                    return day, item
    raise HTTPException(status.HTTP_404_NOT_FOUND, "일정을 찾을 수 없어요.")


def find_day(trip: TripState, plan_id: str, day_no: int) -> DayPlan:
    for plan in trip.plans:
        if plan.id == plan_id:
            for day in plan.days:
                if day.day == day_no:
                    return day
    raise HTTPException(status.HTTP_404_NOT_FOUND, "해당 일차를 찾을 수 없어요.")


def plan_label(trip: TripState, day: DayPlan) -> str:
    for plan in trip.plans:
        if any(d is day for d in plan.days):
            return f"{plan.label} {day.day}일차"
    return f"{day.day}일차"


def add_history(item: PlanItem, actor: str, action: str) -> None:
    item.history.append(HistoryEntry(actor=actor, action=action, at=now_iso()))
    item.history = item.history[-20:]


Token = Annotated[str | None, Header(alias="X-Participant-Token")]


async def refresh_parking(trip_id: str, token: str | None, trip: TripState) -> TripState:
    """자차 여행이면 주차장 정보가 없는 장소에 가장 가까운 주차장을 채워 넣는다."""
    if not trip.spec or trip.spec.transport != "자차" or not settings.kakao_rest_api_key:
        return trip
    targets = [
        i.model_copy(deep=True)
        for p in trip.plans
        for d in p.days
        for i in d.items
        if i.lat is not None and i.nearby_parking is None
    ]
    if not targets:
        return trip
    await attach_parking(targets)
    found = {t.id: t.nearby_parking for t in targets if t.nearby_parking is not None}
    if not found:
        return trip

    def run(state: TripState, me: ParticipantRecord):
        for p in state.plans:
            for d in p.days:
                for i in d.items:
                    if i.id in found and i.nearby_parking is None:
                        i.nearby_parking = found[i.id]

    updated, _ = mutate(trip_id, token, run)
    return updated


# ---------------------------------------------------------------------------
# 방 생성 / 조회
# ---------------------------------------------------------------------------


@app.post("/api/route")
async def get_route(body: RouteRequest) -> list[LegResult | None]:
    """구간별 실제 경로(자동차: 카카오모빌리티, 도보: OSM). 못 구한 구간은 null."""
    return await route_legs(body.legs)


@app.get("/api/places/search")
async def search_places(q: str, region: str = "") -> list[dict]:
    """숙소 등 장소를 카카오에서 검색한다(여행 조건 입력용)."""
    q = q.strip()
    if not q or not settings.kakao_rest_api_key:
        return []
    return await search_kakao_places(f"{region} {q}".strip() if region and region not in q else q)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "gemini": bool(settings.gemini_api_key), "model": settings.gemini_model, "kakao": bool(settings.kakao_rest_api_key)}


@app.post("/api/trips", status_code=status.HTTP_201_CREATED)
def create_trip() -> TripCreated:
    trip = store.create()
    return TripCreated(id=trip.id)


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str) -> TripPublic:
    return to_public(get_trip_or_404(trip_id))


@app.get("/api/trips/{trip_id}/version")
def get_version(trip_id: str) -> dict:
    try:
        return {"version": store.version(trip_id)}
    except TripNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "여행 방을 찾을 수 없어요.")


# ---------------------------------------------------------------------------
# 참여(닉네임 + 6자리 PIN)
# ---------------------------------------------------------------------------


@app.post("/api/trips/{trip_id}/join")
def join_trip(trip_id: str, body: JoinRequest, response: Response) -> JoinResponse:
    token = new_token()

    def run(trip: TripState):
        existing = next((p for p in trip.participants if p.nickname == body.nickname), None)
        if existing:
            now = datetime.now(timezone.utc)
            if existing.locked_until and datetime.fromisoformat(existing.locked_until.replace("Z", "+00:00")) > now:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"PIN 오류가 반복되어 {LOCK_MINUTES}분간 잠겼어요.")
            if not verify_pin(body.pin, existing.pin_salt, existing.pin_hash):
                existing.failed_attempts += 1
                if existing.failed_attempts >= MAX_PIN_FAILURES:
                    existing.failed_attempts = 0
                    existing.locked_until = (now + timedelta(minutes=LOCK_MINUTES)).isoformat()
                # 실패 횟수는 저장해야 하므로 예외 대신 결과로 전달
                return None
            existing.failed_attempts = 0
            existing.locked_until = None
            existing.token_hashes = (existing.token_hashes + [hash_token(token)])[-5:]
            log(trip, existing.nickname, "다시 입장했어요")
            return existing, False

        salt, pin_hash = hash_pin(body.pin)
        participant = ParticipantRecord(
            id=new_id(),
            nickname=body.nickname,
            allergies=body.allergies,
            dislikes=body.dislikes,
            preferred_tags=body.preferred_tags,
            joined_at=now_iso(),
            color=PARTICIPANT_COLORS[len(trip.participants) % len(PARTICIPANT_COLORS)],
            pin_salt=salt,
            pin_hash=pin_hash,
            token_hashes=[hash_token(token)],
        )
        trip.participants.append(participant)
        log(trip, participant.nickname, "여행에 참여했어요")
        return participant, True

    try:
        _, result = store.mutate(trip_id, run)
    except TripNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "여행 방을 찾을 수 없어요.")
    if result is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이미 사용 중인 닉네임이에요. PIN이 일치하지 않아요.")
    participant, created = result
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return JoinResponse(participant=ParticipantPublic(**participant.model_dump()), token=token)


@app.get("/api/trips/{trip_id}/me")
def get_me(trip_id: str, token: Token = None) -> ParticipantPublic:
    trip = get_trip_or_404(trip_id)
    return ParticipantPublic(**find_participant(trip, token).model_dump())


@app.put("/api/trips/{trip_id}/me/preferences")
def update_preferences(trip_id: str, body: PreferencesUpdate, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        me.allergies, me.dislikes, me.preferred_tags = body.allergies, body.dislikes, body.preferred_tags
        log(trip, me.nickname, "음식 취향을 수정했어요")

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


# ---------------------------------------------------------------------------
# 여행 조건
# ---------------------------------------------------------------------------


@app.put("/api/trips/{trip_id}/spec")
async def update_spec(trip_id: str, body: TripSpec, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        first = trip.spec is None
        trip.spec = body.normalized()
        # 숙소를 추가·변경·삭제하면 이미 만든 일정의 숙소 항목도 바로 갱신한다
        inject_lodging(trip.plans, trip.spec)
        log(trip, me.nickname, "여행 조건을 설정했어요" if first else "여행 조건을 수정했어요", trip.spec.region)

    trip, _ = mutate(trip_id, token, run)
    trip = await refresh_parking(trip_id, token, trip)
    return to_public(trip)


# ---------------------------------------------------------------------------
# AI 플랜 생성
# ---------------------------------------------------------------------------


def build_travel_request(trip: TripState) -> TravelRequest:
    if not trip.spec:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "먼저 여행 조건을 입력해 주세요.")
    return TravelRequest(
        spec=trip.spec,
        participants=[
            ParticipantPreference(
                nickname=p.nickname, allergies=p.allergies, dislikes=p.dislikes, preferred_tags=p.preferred_tags
            )
            for p in trip.participants
        ],
    )


@app.post("/api/generate-plan")
async def generate_plan(body: TravelRequest) -> TripPlanResponse:
    """상태 없이 TravelRequest -> TripPlanResponse 만 반환하는 순수 생성 엔드포인트."""
    try:
        result, _ = await generate_trip_plan(body)
    except PlannerError as exc:
        raise HTTPException(exc.status_code, str(exc))
    return result


@app.post("/api/trips/{trip_id}/generate")
async def generate_for_trip(trip_id: str, token: Token = None) -> TripPublic:
    """방의 조건 + 참여자 취향으로 플랜을 생성해 저장한다(기존 플랜은 교체)."""
    trip = get_trip_or_404(trip_id)
    me = find_participant(trip, token)
    req = build_travel_request(trip)
    # 카카오 키가 있으면 실제 장소 후보를 먼저 모아 AI 가 그 안에서만 고르게 한다
    candidates = await collect_candidates(req.spec) if settings.gemini_api_key else []
    try:
        result, source = await generate_trip_plan(req, candidates_prompt(candidates) + lodging_prompt(req.spec))
    except PlannerError as exc:
        raise HTTPException(exc.status_code, str(exc))
    plans = to_plan_options(result, req)
    if source == "gemini":
        await verify_plans(plans, req.spec.region, candidates)
    inject_lodging(plans, req.spec)
    if req.spec.transport == "자차":
        await attach_parking([i for p in plans for d in p.days for i in d.items])

    def run(state: TripState, actor: ParticipantRecord):
        state.plans = plans
        state.plan_source = source  # type: ignore[assignment]
        state.generated_at = now_iso()
        log(state, actor.nickname, "AI 여행 계획을 생성했어요", f"{req.spec.region} {req.spec.normalized().days}일")

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


@app.post("/api/trips/{trip_id}/locate")
async def locate_trip_items(trip_id: str, token: Token = None) -> TripPublic:
    """좌표가 없는 기존 일정 장소를 카카오에서 찾아 주소·좌표를 채운다(지도 표시용)."""
    if not settings.kakao_rest_api_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "카카오 REST API 키가 설정되지 않았어요.")
    snapshot = get_trip_or_404(trip_id)
    find_participant(snapshot, token)
    if not snapshot.spec:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "먼저 여행 조건을 입력해 주세요.")
    targets = [
        item.model_copy(deep=True)
        for plan in snapshot.plans
        for day in plan.days
        for item in day.items
        if item.lat is None and item.category != "이동"
    ]
    await verify_items(targets, snapshot.spec.region)
    found = {t.id: t for t in targets if t.verified}
    missing = {t.id for t in targets if t.verified is False}

    def run(trip: TripState, me: ParticipantRecord):
        for plan in trip.plans:
            for day in plan.days:
                for item in day.items:
                    if item.id in found:
                        for key in LOCATION_FIELDS:
                            setattr(item, key, getattr(found[item.id], key))
                    elif item.id in missing:
                        item.verified = False
        log(trip, me.nickname, "지도 위치를 불러왔어요", f"{len(found)}/{len(targets)}곳")

    trip, _ = mutate(trip_id, token, run)
    trip = await refresh_parking(trip_id, token, trip)
    return to_public(trip)


@app.post("/api/trips/{trip_id}/replace-unverified")
async def replace_unverified(trip_id: str, token: Token = None) -> TripPublic:
    """카카오에서 찾지 못한 장소를 앞뒤 일정 근처의 같은 종류 실제 장소로 바꾼다."""
    if not settings.kakao_rest_api_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "카카오 REST API 키가 설정되지 않았어요.")
    snapshot = get_trip_or_404(trip_id)
    find_participant(snapshot, token)
    if not snapshot.spec:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "먼저 여행 조건을 입력해 주세요.")

    everywhere = [i for p in snapshot.plans for d in p.days for i in d.items if i.lat is not None]
    requests: list[tuple[PlanItem, tuple[float, float]]] = []
    for plan in snapshot.plans:
        for day in plan.days:
            located = [(idx, i) for idx, i in enumerate(day.items) if i.lat is not None]
            for idx, item in enumerate(day.items):
                if item.verified is not False:
                    continue
                # 기준 좌표: 같은 날 가장 가까운 순서의 확인된 장소 → 없으면 전체 확인된 장소의 평균
                near = min(located, key=lambda li: abs(li[0] - idx), default=None)
                if near:
                    anchor = (near[1].lat, near[1].lng)
                elif everywhere:
                    anchor = (sum(i.lat for i in everywhere) / len(everywhere), sum(i.lng for i in everywhere) / len(everywhere))
                else:
                    continue
                requests.append((item, anchor))  # type: ignore[arg-type]
    if not requests:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "바꿀 장소가 없어요. 먼저 '지도 위치 불러오기'를 해 주세요.")

    exclude = {i.place_url for i in everywhere if i.place_url}
    found = await find_replacements(requests, snapshot.spec.region, exclude)

    def run(trip: TripState, me: ParticipantRecord):
        changed = 0
        for plan in trip.plans:
            for day in plan.days:
                for item in day.items:
                    if item.id in found and item.verified is False:
                        old = apply_replacement(item, found[item.id])
                        add_history(item, me.nickname, f"'{old}' → 근처 실제 장소로 교체")
                        changed += 1
        log(trip, me.nickname, "확인 안 된 장소를 실제 장소로 바꿨어요", f"{changed}/{len(requests)}곳")

    trip, _ = mutate(trip_id, token, run)
    trip = await refresh_parking(trip_id, token, trip)
    return to_public(trip)


# ---------------------------------------------------------------------------
# 일정 편집 (추가 / 수정 / 삭제 / 순서 변경)
# ---------------------------------------------------------------------------


LOCATION_FIELDS = ("name", "address", "place_url", "search_keyword", "lat", "lng", "verified")


async def locate(trip: TripState, name: str) -> PlanItem | None:
    """직접 추가/이름 변경한 장소를 카카오에서 찾아 주소·좌표를 채운 임시 아이템을 돌려준다."""
    if not trip.spec:
        return None
    probe = PlanItem(id="probe", name=name, search_keyword=f"{trip.spec.region} {name}")
    await verify_items([probe], trip.spec.region)
    # 사용자가 직접 넣은 장소는 못 찾아도 '확인 필요'로 표시하지 않는다(해외·신규 가게 등)
    return probe if probe.verified else None


@app.post("/api/trips/{trip_id}/plans/{plan_id}/days/{day_no}/items", status_code=status.HTTP_201_CREATED)
async def add_item(trip_id: str, plan_id: str, day_no: int, body: ItemCreate, token: Token = None) -> TripPublic:
    found = await locate(get_trip_or_404(trip_id), body.name)

    def run(trip: TripState, me: ParticipantRecord):
        day = find_day(trip, plan_id, day_no)
        item = PlanItem(id=new_id(), custom=True, search_keyword=body.name, **body.model_dump())
        if found:
            for key in LOCATION_FIELDS:
                setattr(item, key, getattr(found, key))
        add_history(item, me.nickname, "일정을 추가")
        day.items.append(item)
        log(trip, me.nickname, "일정을 추가했어요", f"{plan_label(trip, day)} · {item.name}")

    trip, _ = mutate(trip_id, token, run)
    trip = await refresh_parking(trip_id, token, trip)
    return to_public(trip)


FIELD_LABELS = {
    "name": "장소명",
    "category": "카테고리",
    "start_time": "시간",
    "duration_minutes": "체류 시간",
    "memo": "메모",
    "reason": "설명",
}


@app.patch("/api/trips/{trip_id}/items/{item_id}")
async def patch_item(trip_id: str, item_id: str, body: ItemPatch, token: Token = None) -> TripPublic:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "변경할 내용이 없어요.")
    snapshot = get_trip_or_404(trip_id)
    _, current = find_item(snapshot, item_id)
    new_name = changes.get("name")
    found = await locate(snapshot, new_name) if new_name and new_name != current.name else None

    def run(trip: TripState, me: ParticipantRecord):
        day, item = find_item(trip, item_id)
        changed = [k for k, v in changes.items() if v is not None and getattr(item, k) != v]
        if not changed:
            return
        for key in changed:
            setattr(item, key, changes[key])
        if "name" in changed:
            # 이름이 바뀌면 이전 장소의 주소·좌표는 더 이상 맞지 않는다
            item.search_keyword, item.address, item.place_url = item.name, "", ""
            item.lat = item.lng = item.verified = item.nearby_parking = None
            item.parking, item.parking_note = "모름", ""
            if found:
                for key in LOCATION_FIELDS:
                    setattr(item, key, getattr(found, key))
        label = ", ".join(FIELD_LABELS[k] for k in changed)
        add_history(item, me.nickname, f"{label} 변경")
        log(trip, me.nickname, f"{label}을(를) 변경했어요", f"{plan_label(trip, day)} · {item.name}")

    trip, _ = mutate(trip_id, token, run)
    trip = await refresh_parking(trip_id, token, trip)
    return to_public(trip)


@app.delete("/api/trips/{trip_id}/items/{item_id}")
def delete_item(trip_id: str, item_id: str, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        day, item = find_item(trip, item_id)
        day.items = [i for i in day.items if i.id != item_id]
        log(trip, me.nickname, "일정을 삭제했어요", f"{plan_label(trip, day)} · {item.name}")

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


@app.put("/api/trips/{trip_id}/plans/{plan_id}/days/{day_no}/order")
def reorder_items(trip_id: str, plan_id: str, day_no: int, body: ReorderRequest, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        day = find_day(trip, plan_id, day_no)
        by_id = {i.id: i for i in day.items}
        if sorted(by_id) != sorted(body.item_ids):
            raise HTTPException(status.HTTP_409_CONFLICT, "다른 참여자가 먼저 일정을 바꿨어요. 새로고침 후 다시 시도해 주세요.")
        day.items = [by_id[i] for i in body.item_ids]
        log(trip, me.nickname, "일정 순서를 바꿨어요", plan_label(trip, day))

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


# ---------------------------------------------------------------------------
# 투표 / 코멘트
# ---------------------------------------------------------------------------


@app.put("/api/trips/{trip_id}/items/{item_id}/vote")
def vote_item(trip_id: str, item_id: str, body: VoteRequest, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        _, item = find_item(trip, item_id)
        if body.value is None:
            item.votes.pop(me.id, None)
        else:
            item.votes[me.id] = body.value
            log(trip, me.nickname, "좋아요를 눌렀어요" if body.value == "like" else "별로예요를 눌렀어요", item.name)

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


@app.post("/api/trips/{trip_id}/items/{item_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(trip_id: str, item_id: str, body: CommentCreate, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        _, item = find_item(trip, item_id)
        parent_id = None
        if body.parent_id:
            parent = next((c for c in item.comments if c.id == body.parent_id), None)
            if not parent:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "답글을 달 코멘트를 찾을 수 없어요.")
            # 답글의 답글은 같은 스레드(최상위 코멘트) 아래에 단다
            parent_id = parent.parent_id or parent.id
        item.comments.append(
            Comment(
                id=new_id(), author_id=me.id, author=me.nickname, text=body.text, created_at=now_iso(), parent_id=parent_id
            )
        )
        if parent_id:
            root = next(c for c in item.comments if c.id == parent_id)
            log(trip, me.nickname, f"{root.author}님 코멘트에 답글을 남겼어요", item.name)
        else:
            log(trip, me.nickname, "코멘트를 남겼어요", item.name)

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


@app.patch("/api/trips/{trip_id}/items/{item_id}/comments/{comment_id}")
def edit_comment(trip_id: str, item_id: str, comment_id: str, body: CommentPatch, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        _, item = find_item(trip, item_id)
        target = next((c for c in item.comments if c.id == comment_id and not c.deleted), None)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "코멘트를 찾을 수 없어요.")
        if target.author_id != me.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "내가 쓴 코멘트만 수정할 수 있어요.")
        if target.text != body.text:
            target.text, target.edited_at = body.text, now_iso()

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)


@app.delete("/api/trips/{trip_id}/items/{item_id}/comments/{comment_id}")
def delete_comment(trip_id: str, item_id: str, comment_id: str, token: Token = None) -> TripPublic:
    def run(trip: TripState, me: ParticipantRecord):
        _, item = find_item(trip, item_id)
        target = next((c for c in item.comments if c.id == comment_id), None)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "코멘트를 찾을 수 없어요.")
        if target.author_id != me.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "내가 쓴 코멘트만 삭제할 수 있어요.")
        has_replies = any(c.parent_id == comment_id for c in item.comments)
        if has_replies:
            # 답글은 남기고 원 코멘트 자리만 '삭제된 코멘트'로 표시
            target.deleted, target.text = True, ""
        else:
            item.comments = [c for c in item.comments if c.id != comment_id]
            # 지워진 원 코멘트에 마지막 답글까지 사라지면 빈 자리도 정리
            if target.parent_id:
                root = next((c for c in item.comments if c.id == target.parent_id), None)
                if root and root.deleted and not any(c.parent_id == root.id for c in item.comments):
                    item.comments = [c for c in item.comments if c.id != root.id]

    trip, _ = mutate(trip_id, token, run)
    return to_public(trip)
