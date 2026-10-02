"""Pydantic v2 스키마.

- AI 입출력: TravelRequest(입력) / TripPlanResponse(Gemini Structured Output)
- 저장/응답: TripState, PlanItem 등 협업 상태 모델

주의: Gemini response_schema 로 쓰이는 모델(TripPlanResponse 하위)에는
기본값(default)·dict 타입을 두지 않는다. Gemini 스키마 변환기가 이를 지원하지 않는다.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

HHMM = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
HHMMOrEmpty = Annotated[str, StringConstraints(pattern=r"^(([01]\d|2[0-3]):[0-5]\d)?$")]

Theme = Literal[
    "힐링",
    "맛집 투어",
    "카페 투어",
    "야외 액티비티",
    "실내 문화/전시",
    "쇼핑",
    "호캉스",
    "자연 경관",
    "역사 탐방",
    "야경/나이트라이프",
    "실내 액티비티",
    "체험/클래스",
    "테마파크",
    "바다/해변",
    "등산/트레킹",
    "스파/온천",
    "공연/축제",
    "사진 명소",
    "로컬 시장",
    "드라이브",
    "아이와 함께",
    "반려동물 동반",
]
Drinking = Literal["안 마셔요", "가볍게 한두 잔", "술자리 좋아요"]
DRINK_TYPES = ["소주", "맥주", "와인", "막걸리·전통주", "하이볼·칵테일", "위스키", "사케"]
Cuisine = Literal["한식", "중식", "일식", "양식", "아시아음식", "분식", "패스트푸드", "치킨", "뷔페", "술집"]
AgeGroup = Literal["영유아", "10대", "20대", "30대", "40대", "50대", "60대 이상"]
GenderMix = Literal["남성만", "여성만", "혼성", "미정"]
Category = Literal["식당", "카페", "관광지", "액티비티", "쇼핑", "숙소", "문화/전시", "휴식", "이동", "기타"]
Weekday = Literal["월", "화", "수", "목", "금", "토", "일"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# 여행 조건
# ---------------------------------------------------------------------------


class Lodging(StrictModel):
    """이미 예약한 숙소 (카카오 검색으로 고르면 주소·좌표가 채워진다)"""

    name: str = Field(..., min_length=1, max_length=60)
    address: str = Field("", max_length=120)
    place_url: str = Field("", max_length=200)
    lat: float | None = None
    lng: float | None = None
    check_in: HHMM = "15:00"
    check_out: HHMM = "11:00"
    # 이 숙소에 묵는 밤 (1 = 1일차 밤, 2 = 2일차 밤 …)
    nights: list[Annotated[int, Field(ge=1, le=30)]] = Field(default_factory=list)


class MustVisitPlace(StrictModel):
    name: str = Field(..., min_length=1, max_length=60)
    address: str = ""
    place_url: str = ""
    lat: float | None = None
    lng: float | None = None
    day: int | None = Field(None, ge=1, le=31, description="몇 일차 (None = 아무 날)")
    slot: Literal["", "오전", "점심", "오후", "저녁"] = ""


class TripSpec(StrictModel):
    title: str = Field("", max_length=60)
    region: str = Field(..., min_length=1, max_length=60)
    duration_mode: Literal["rough", "exact"] = "rough"
    nights: int = Field(1, ge=0, le=30)
    days: int = Field(2, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    start_time: HHMM | None = None
    end_time: HHMM | None = None
    headcount: int | None = Field(None, ge=1, le=100)
    headcount_undecided: bool = False
    gender_mix: GenderMix = "미정"
    age_groups: list[AgeGroup] = Field(default_factory=list)
    themes: list[Theme] = Field(default_factory=list, max_length=10)
    budget_level: Literal["알뜰", "보통", "여유"] = "보통"
    transport: Literal["대중교통", "자차", "도보 위주", "미정"] = "미정"
    max_travel_minutes: int = Field(30, ge=5, le=180, description="연속한 두 장소 사이 최대 이동 시간(분)")
    # 대중교통·미정 여행에서 걸어서 이동할 수 있는 최대 시간(분). 도보 위주면 max_travel_minutes 가 곧 도보 한도
    max_walk_minutes: int = Field(15, ge=5, le=60)
    lodgings: list[Lodging] = Field(default_factory=list, max_length=15)
    # 꼭 가야 하는 곳 (조건 화면에서 직접 고른 장소)
    must_visits: list["MustVisitPlace"] = Field(default_factory=list, max_length=15)
    # 체크를 푼(빼 달라는) 음식 종류. 비어 있으면 모든 음식 가능
    excluded_cuisines: list[Cuisine] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _migrate_single_lodging(cls, data):
        """예전 형식(lodging: 숙소 하나)을 lodgings 로 바꾼다. 모든 밤을 그 숙소로 본다."""
        if isinstance(data, dict) and "lodging" in data:
            data = dict(data)
            single = data.pop("lodging")
            if single and not data.get("lodgings"):
                nights = int(data.get("nights") or 1)
                data["lodgings"] = [{**single, "nights": list(range(1, max(nights, 1) + 1))}]
        return data

    def lodging_for_night(self, night: int) -> tuple[int, "Lodging"] | None:
        """해당 밤에 묵는 숙소 (목록 인덱스, 숙소). 먼저 지정된 숙소가 우선"""
        for idx, lodging in enumerate(self.lodgings):
            if night in lodging.nights:
                return idx, lodging
        return None
    notes: str = Field("", max_length=500)

    def normalized(self) -> "TripSpec":
        """구체 날짜 모드면 박/일 수를 날짜로부터 다시 계산한다."""
        data = self.model_copy()
        if data.duration_mode == "exact" and data.start_date:
            end = data.end_date or data.start_date
            if end < data.start_date:
                end = data.start_date
            data.end_date = end
            data.days = (end - data.start_date).days + 1
            data.nights = data.days - 1
        if data.headcount_undecided:
            data.headcount = None
        return data


class ParticipantPreference(StrictModel):
    nickname: str
    allergies: list[str] = Field(default_factory=list)
    dislikes: list[str] = Field(default_factory=list)
    preferred_tags: list[str] = Field(default_factory=list)
    drinking: Drinking | None = None
    drink_types: list[str] = Field(default_factory=list)


class MustVisit(BaseModel):
    name: str = Field(description="사용자가 꼭 가겠다고 한 장소의 상호명(사용자가 쓴 그대로, 지점명 포함)")
    day: int | None = Field(None, description="몇 일차에 가는지 (모르면 null)")
    slot: str = Field("", description="'점심' | '저녁' | '아침' | '오전' | '오후' | '' 중 하나")


class DayArea(BaseModel):
    day: int
    area: str = Field(description="그날 주로 노는 지역 이름 (예: 하남, 잠실)")


class NoteRequirements(BaseModel):
    """'AI에게 추가로 요청할 점'을 구조화한 결과"""

    must_visit: list[MustVisit] = Field(default_factory=list, description="이름이 나온 특정 장소만. '카페', '고기집' 같은 일반 명사는 넣지 않음")
    day_areas: list[DayArea] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list, description="일정이 지켜야 할 규칙을 짧은 명령문으로 (예: '1일차 점심은 한식 제외')")


class TravelRequest(StrictModel):
    """AI 플래너에 전달되는 입력 데이터."""

    spec: TripSpec
    participants: list[ParticipantPreference] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Gemini Structured Output 스키마 (기본값 금지)
# ---------------------------------------------------------------------------


class AIPlace(BaseModel):
    name: str = Field(description="실제 존재하는 장소의 정확한 상호명/명칭")
    category: Category
    start_time: str = Field(description="방문 시작 시각 HH:MM (24시간)")
    duration_minutes: int = Field(description="예상 체류 시간(분)")
    reason: str = Field(description="그룹 조건을 반영한 한두 문장의 추천 사유")
    area: str = Field(description="동/역 등 대략적 위치 (예: 성수동, 해운대역 인근)")
    search_keyword: str = Field(description="지도 앱 검색용 키워드 (지역명 + 상호명)")
    open_time: str = Field(description="영업 시작 HH:MM, 모르면 빈 문자열")
    close_time: str = Field(description="영업 종료 HH:MM, 자정 넘기면 24:00 이상 대신 23:59, 모르면 빈 문자열")
    break_start: str = Field(description="브레이크 타임 시작 HH:MM, 없거나 모르면 빈 문자열")
    break_end: str = Field(description="브레이크 타임 종료 HH:MM, 없거나 모르면 빈 문자열")
    closed_days: list[Weekday] = Field(description="정기 휴무 요일 목록, 없으면 빈 배열")
    reservation_recommended: bool = Field(description="예약을 권장하는 식당/카페면 true")
    on_catchtable: bool = Field(
        description="캐치테이블(CatchTable) 앱에 입점해 예약/웨이팅이 가능하다고 확실히 알고 있는 식당/카페면 true, 모르면 false"
    )
    on_naver_booking: bool = Field(
        description="네이버 예약(네이버 플레이스 예약)으로 예약을 받는다고 확실히 알고 있는 곳이면 true, 모르면 false"
    )
    parking: Literal["무료", "유료", "없음", "모름"] = Field(
        description="자체/제휴 주차 가능 여부와 요금. 확실히 알 때만 무료/유료/없음, 모르면 '모름'"
    )
    parking_note: str = Field(
        description="주차 요금·무료 시간 등 알려진 정보 한 줄 (예: '구매 시 3시간 무료', '10분당 1,000원'), 모르면 빈 문자열"
    )
    tip: str = Field(description="현장 팁 한 줄 (대기, 주차, 추천 메뉴 등), 없으면 빈 문자열")


class AIDayPlan(BaseModel):
    day: int = Field(description="1부터 시작하는 일차")
    title: str = Field(description="그날의 짧은 테마 제목")
    places: list[AIPlace]


class AIPlanOption(BaseModel):
    title: str = Field(description="플랜 제목")
    concept: str = Field(description="플랜의 콘셉트를 설명하는 한두 문장")
    days: list[AIDayPlan]


class TripPlanResponse(BaseModel):
    main_plan: AIPlanOption = Field(description="1안: 조건에 가장 충실한 메인 플랜")
    alternative_plan: AIPlanOption = Field(description="2안: 더 여유롭거나 다른 동선/테마의 대체 플랜")


# ---------------------------------------------------------------------------
# 협업 상태 (저장 모델)
# ---------------------------------------------------------------------------


class NearbyParking(BaseModel):
    """카카오에서 찾은 가장 가까운 주차장"""

    name: str
    distance_m: int
    place_url: str = ""


class Comment(BaseModel):
    id: str
    author_id: str
    author: str
    text: str
    created_at: str
    # 답글이면 원 코멘트 id (답글은 한 단계까지만)
    parent_id: str | None = None
    edited_at: str | None = None
    # 답글이 달린 코멘트를 지우면 내용만 지우고 자리를 남긴다
    deleted: bool = False


class HistoryEntry(BaseModel):
    actor: str
    action: str
    at: str


class PlanItem(BaseModel):
    id: str
    name: str
    category: Category = "기타"
    # 카카오 업종 분류 전체 경로 (예: '음식점 > 한식 > 국수'). 음식 종류 제외 검사에 쓴다
    kakao_category: str = ""
    start_time: str = ""
    duration_minutes: int = 60
    reason: str = ""
    area: str = ""
    search_keyword: str = ""
    open_time: str = ""
    close_time: str = ""
    break_start: str = ""
    break_end: str = ""
    closed_days: list[str] = Field(default_factory=list)
    reservation_recommended: bool = False
    on_catchtable: bool = False
    on_naver_booking: bool = False
    parking: str = "모름"
    parking_note: str = ""
    # None = 조회 안 함, name="" = 반경 안에 주차장 없음
    nearby_parking: NearbyParking | None = None
    tip: str = ""
    # 카카오 로컬 검증 결과: None = 검증 안 함(키 없음/해외 등), True = 실존 확인, False = 찾지 못함
    verified: bool | None = None
    address: str = ""
    place_url: str = ""
    lat: float | None = None
    lng: float | None = None
    # 여행 조건의 숙소로 자동 생성된 항목 (숙소 변경 시 다시 만들어진다)
    lodging: bool = False
    memo: str = ""
    custom: bool = False
    votes: dict[str, Literal["like", "dislike"]] = Field(default_factory=dict)
    comments: list[Comment] = Field(default_factory=list)
    history: list[HistoryEntry] = Field(default_factory=list)


class DayPlan(BaseModel):
    day: int
    date: str | None = None
    title: str = ""
    items: list[PlanItem] = Field(default_factory=list)


class PlanOption(BaseModel):
    id: str
    label: str
    title: str
    concept: str = ""
    days: list[DayPlan] = Field(default_factory=list)


class ActivityLog(BaseModel):
    id: str
    actor: str
    action: str
    target: str = ""
    at: str


class ParticipantRecord(BaseModel):
    id: str
    nickname: str
    allergies: list[str] = Field(default_factory=list)
    dislikes: list[str] = Field(default_factory=list)
    preferred_tags: list[str] = Field(default_factory=list)
    drinking: Drinking | None = None
    drink_types: list[str] = Field(default_factory=list)
    joined_at: str
    color: str
    # 취향을 직접 입력(또는 '없음'으로 확인)한 시각. 단계 표시에서 "취향 모으기" 판단에 쓴다
    prefs_saved_at: str | None = None
    # 비공개 필드
    pin_salt: str
    pin_hash: str
    token_hashes: list[str] = Field(default_factory=list)
    failed_attempts: int = 0
    locked_until: str | None = None


class TripState(BaseModel):
    id: str
    version: int = 1
    created_at: str
    updated_at: str
    spec: TripSpec | None = None
    participants: list[ParticipantRecord] = Field(default_factory=list)
    plans: list[PlanOption] = Field(default_factory=list)
    plan_source: Literal["gemini", "mock"] | None = None
    generated_at: str | None = None
    activity: list[ActivityLog] = Field(default_factory=list)
    # 함께 확정한 안 (확정 전에는 None)
    confirmed_plan_id: str | None = None
    confirmed_at: str | None = None
    confirmed_by: str | None = None
    # 참여자별 확정 동의 (participant_id → plan_id). 모두 같은 안에 동의하면 확정된다
    confirm_votes: dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# API 요청/응답
# ---------------------------------------------------------------------------


class ParticipantPublic(BaseModel):
    id: str
    nickname: str
    allergies: list[str]
    dislikes: list[str]
    preferred_tags: list[str]
    drinking: Drinking | None = None
    drink_types: list[str] = Field(default_factory=list)
    joined_at: str
    color: str
    prefs_saved_at: str | None = None


class TripPublic(BaseModel):
    id: str
    version: int
    created_at: str
    updated_at: str
    spec: TripSpec | None
    participants: list[ParticipantPublic]
    plans: list[PlanOption]
    plan_source: Literal["gemini", "mock"] | None
    generated_at: str | None
    activity: list[ActivityLog]
    confirmed_plan_id: str | None = None
    confirmed_at: str | None = None
    confirmed_by: str | None = None
    confirm_votes: dict[str, str] = Field(default_factory=dict)


TagList = Annotated[list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]], Field(max_length=20)]


class JoinRequest(StrictModel):
    nickname: str = Field(..., min_length=1, max_length=12)
    pin: str = Field(..., pattern=r"^\d{6}$")
    allergies: TagList = Field(default_factory=list)
    dislikes: TagList = Field(default_factory=list)
    preferred_tags: TagList = Field(default_factory=list)
    drinking: Drinking | None = None
    drink_types: TagList = Field(default_factory=list)


class JoinResponse(BaseModel):
    participant: ParticipantPublic
    token: str


class PreferencesUpdate(StrictModel):
    allergies: TagList = Field(default_factory=list)
    dislikes: TagList = Field(default_factory=list)
    preferred_tags: TagList = Field(default_factory=list)
    drinking: Drinking | None = None
    drink_types: TagList = Field(default_factory=list)


class ItemCreate(StrictModel):
    name: str = Field(..., min_length=1, max_length=60)
    category: Category = "기타"
    start_time: HHMMOrEmpty = ""
    duration_minutes: int = Field(60, ge=0, le=24 * 60)
    memo: str = Field("", max_length=300)


class ItemPatch(StrictModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    category: Category | None = None
    start_time: HHMMOrEmpty | None = None
    duration_minutes: int | None = Field(None, ge=0, le=24 * 60)
    memo: str | None = Field(None, max_length=300)
    reason: str | None = Field(None, max_length=300)


class ConfirmRequest(StrictModel):
    # 내 확정 동의. None 이면 동의 취소
    plan_id: str | None = None


class ReorderRequest(StrictModel):
    item_ids: list[str]


class VoteRequest(StrictModel):
    value: Literal["like", "dislike"] | None


class CommentCreate(StrictModel):
    text: str = Field(..., min_length=1, max_length=300)
    parent_id: str | None = None


class CommentPatch(StrictModel):
    text: str = Field(..., min_length=1, max_length=300)


class TripCreated(BaseModel):
    id: str
