import { differenceInMinutes, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

import type { DayPlan, PlanItem, TripSpec } from "@/lib/types";

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function endTime(item: Pick<PlanItem, "start_time" | "duration_minutes">): string {
  const start = toMinutes(item.start_time);
  return start === null ? "" : fromMinutes(start + item.duration_minutes);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 서버 타임스탬프(UTC ISO) → "3분 전" */
export function timeAgo(iso: string): string {
  try {
    const date = parseISO(iso);
    if (Math.abs(differenceInMinutes(new Date(), date)) < 1) return "방금";
    return formatDistanceToNowStrict(date, { locale: ko, addSuffix: true });
  } catch {
    return "";
  }
}

/** 서버 타임스탬프 → "14:20" (당일) 또는 "9/30 14:20" */
export function clockTime(iso: string): string {
  try {
    const date = parseISO(iso);
    const sameDay = format(date, "yyyyMMdd") === format(new Date(), "yyyyMMdd");
    return format(date, sameDay ? "HH:mm" : "M/d HH:mm");
  } catch {
    return "";
  }
}

export function dayLabel(day: DayPlan): string {
  if (!day.date) return `Day ${day.day}`;
  return `Day ${day.day} · ${format(parseISO(day.date), "M월 d일 (EEE)", { locale: ko })}`;
}

export function specSummary(spec: TripSpec): string {
  const period =
    spec.duration_mode === "exact" && spec.start_date
      ? `${format(parseISO(spec.start_date), "M.d")}${
          spec.end_date && spec.end_date !== spec.start_date ? `–${format(parseISO(spec.end_date), "M.d")}` : ""
        } · ${spec.nights}박 ${spec.days}일`
      : `${spec.nights}박 ${spec.days}일`;
  const people = spec.headcount_undecided || !spec.headcount ? "인원 미정" : `${spec.headcount}명`;
  return `${spec.region} · ${period} · ${people}`;
}

// ---------------------------------------------------------------------------
// 영업 상태 배지: "방문 예정 시각"을 기준으로 영업시간/브레이크/휴무를 판단
// ---------------------------------------------------------------------------

export type BusinessStatus =
  | { kind: "open"; label: string }
  | { kind: "break"; label: string }
  | { kind: "closed"; label: string }
  | { kind: "dayoff"; label: string }
  | { kind: "unknown"; label: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function businessStatus(item: PlanItem, date: string | null): BusinessStatus {
  if (date && item.closed_days.length) {
    const weekday = WEEKDAYS[parseISO(date).getDay()];
    if (item.closed_days.includes(weekday)) return { kind: "dayoff", label: `${weekday}요일 휴무` };
  }
  const visit = toMinutes(item.start_time);
  const open = toMinutes(item.open_time);
  let close = toMinutes(item.close_time);
  if (visit === null || open === null || close === null) return { kind: "unknown", label: "영업시간 확인 필요" };
  if (close <= open) close += 1440; // 자정 넘김 영업

  const bs = toMinutes(item.break_start);
  const be = toMinutes(item.break_end);
  if (bs !== null && be !== null && visit >= bs && visit < be) return { kind: "break", label: "방문 시각 브레이크 타임" };
  if (visit < open || visit >= close) return { kind: "closed", label: "방문 시각 영업 전/종료" };
  if (close - visit < 30) return { kind: "open", label: "마감 임박" };
  return { kind: "open", label: "방문 시각 영업 중" };
}

/** 여행 날짜 기준 상태: D-12 / 여행 중 / 다녀옴 (날짜 미정이면 null) */
export function tripDDay(spec: TripSpec | null): { label: string; tone: string } | null {
  if (!spec?.start_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${spec.start_date}T00:00:00`);
  const end = new Date(`${spec.end_date ?? spec.start_date}T00:00:00`);
  const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (diff > 0) return { label: `D-${diff}`, tone: "bg-ink-900 text-white" };
  if (today <= end) return { label: "여행 중", tone: "bg-rose-500 text-white" };
  return { label: "다녀옴", tone: "bg-white/90 text-ink-600" };
}
