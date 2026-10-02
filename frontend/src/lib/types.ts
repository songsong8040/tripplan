// 백엔드(FastAPI/Pydantic) 스키마와 1:1로 맞춘 타입 정의

export const THEMES = [
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
] as const;
export type Theme = (typeof THEMES)[number];

export const AGE_GROUPS = ["영유아", "10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const GENDER_MIX = ["남성만", "여성만", "혼성", "미정"] as const;
export type GenderMix = (typeof GENDER_MIX)[number];

export const CATEGORIES = ["식당", "카페", "관광지", "액티비티", "쇼핑", "숙소", "문화/전시", "휴식", "이동", "기타"] as const;
export type Category = (typeof CATEGORIES)[number];

export type DurationMode = "rough" | "exact";

export interface Lodging {
  name: string;
  address: string;
  place_url: string;
  lat: number | null;
  lng: number | null;
  check_in: string; // HH:MM
  check_out: string;
  /** 이 숙소에 묵는 밤 (1 = 1일차 밤) */
  nights: number[];
}

export interface NearbyParking {
  name: string; // "" = 반경 안에 주차장 없음
  distance_m: number;
  place_url: string;
}

export interface RouteLegResult {
  distance_m: number;
  duration_s: number;
  geometry: [number, number][]; // [lat, lng]
}

export interface PlaceSearchResult {
  name: string;
  address: string;
  place_url: string;
  lat: number | null;
  lng: number | null;
  category: string;
}

export interface TripSpec {
  title: string;
  region: string;
  duration_mode: DurationMode;
  nights: number;
  days: number;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;
  start_time: string | null; // HH:MM
  end_time: string | null;
  headcount: number | null;
  headcount_undecided: boolean;
  gender_mix: GenderMix;
  age_groups: AgeGroup[];
  themes: Theme[];
  budget_level: "알뜰" | "보통" | "여유";
  transport: "대중교통" | "자차" | "도보 위주" | "미정";
  /** 연속한 두 장소 사이 최대 이동 시간(분) */
  max_travel_minutes: number;
  /** 이미 예약한 숙소들 (밤별로 지정, 1박 이상일 때 일정에 자동 반영) */
  lodgings: Lodging[];
  notes: string;
}

export interface Participant {
  id: string;
  nickname: string;
  allergies: string[];
  dislikes: string[];
  preferred_tags: string[];
  joined_at: string;
  color: string;
}

export interface PlaceBase {
  name: string;
  category: Category;
  start_time: string; // HH:MM
  duration_minutes: number;
  reason: string;
  area: string;
  search_keyword: string;
  open_time: string; // HH:MM 또는 ""
  close_time: string;
  break_start: string;
  break_end: string;
  closed_days: string[]; // "월" ~ "일"
  reservation_recommended: boolean;
  on_catchtable: boolean;
  on_naver_booking: boolean;
  /** AI 가 아는 주차 정보 (자차 여행에서 표시) */
  parking: "무료" | "유료" | "없음" | "모름";
  parking_note: string;
  /** 카카오에서 찾은 가장 가까운 주차장 (null = 조회 안 함) */
  nearby_parking: NearbyParking | null;
  tip: string;
  /** 카카오 장소 검증: null = 검증 안 함, true = 실존 확인, false = 찾지 못함 */
  verified: boolean | null;
  address: string;
  place_url: string;
  lat: number | null;
  lng: number | null;
  /** 여행 조건의 숙소로 자동 생성된 체크인/출발/복귀/체크아웃 항목 */
  lodging: boolean;
}

export type VoteValue = "like" | "dislike";

export interface Comment {
  id: string;
  author_id: string;
  author: string;
  text: string;
  created_at: string;
  /** 답글이면 원 코멘트 id (한 단계까지만) */
  parent_id: string | null;
  edited_at: string | null;
  /** 답글이 달린 채 삭제된 코멘트 */
  deleted: boolean;
}

export interface HistoryEntry {
  actor: string;
  action: string;
  at: string;
}

export interface PlanItem extends PlaceBase {
  id: string;
  memo: string;
  custom: boolean;
  votes: Record<string, VoteValue>; // participant_id -> vote
  comments: Comment[];
  history: HistoryEntry[];
}

export interface DayPlan {
  day: number;
  date: string | null;
  title: string;
  items: PlanItem[];
}

export interface PlanOption {
  id: string; // "A" | "B"
  label: string; // "1안" | "2안"
  title: string;
  concept: string;
  days: DayPlan[];
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export interface Trip {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
  spec: TripSpec | null;
  participants: Participant[];
  plans: PlanOption[];
  plan_source: "gemini" | "mock" | null;
  generated_at: string | null;
  activity: ActivityLog[];
}

export interface JoinResponse {
  participant: Participant;
  token: string;
}

export interface ItemPatch {
  name?: string;
  category?: Category;
  start_time?: string;
  duration_minutes?: number;
  memo?: string;
  reason?: string;
}
