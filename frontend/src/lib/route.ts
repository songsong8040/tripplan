import type { DayPlan, PlanItem, TripSpec } from "@/lib/types";

export type LocatedItem = PlanItem & { lat: number; lng: number };

export interface Leg {
  from: LocatedItem;
  to: LocatedItem;
  km: number;
  minutes: number;
  tooFar: boolean;
  directionsUrl: string;
}

// 일정별 색상 (지도 마커/경로선). 마커는 Tailwind 클래스, 경로선은 hex 를 쓴다.
export const DAY_COLORS = [
  { hex: "#8b66ee", bg: "bg-lilac-500", soft: "bg-lilac-100 text-lilac-700", text: "text-lilac-600" },
  { hex: "#3ea97b", bg: "bg-mint-500", soft: "bg-mint-100 text-mint-700", text: "text-mint-600" },
  { hex: "#e86d45", bg: "bg-peach-500", soft: "bg-peach-100 text-peach-700", text: "text-peach-600" },
  { hex: "#3b8cea", bg: "bg-sky-500", soft: "bg-sky-100 text-sky-700", text: "text-sky-600" },
  { hex: "#ec4b78", bg: "bg-rose-500", soft: "bg-rose-100 text-rose-700", text: "text-rose-600" },
  { hex: "#dfa714", bg: "bg-butter-500", soft: "bg-butter-100 text-butter-700", text: "text-butter-600" },
] as const;

export const dayColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

/** 그날의 방문 순서 번호(숙소 항목은 번호 없이 0). 카드·지도 마커·구간 목록이 같은 번호를 쓴다 */
export function placeOrder(day: DayPlan, itemId: string): number {
  const places = day.items.filter((i) => !i.lodging);
  return places.findIndex((i) => i.id === itemId) + 1;
}

export function located(items: PlanItem[]): LocatedItem[] {
  return items.filter((i): i is LocatedItem => typeof i.lat === "number" && typeof i.lng === "number");
}

/** 두 좌표 사이 직선 거리(km) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export type Mode = "walk" | "traffic" | "car";

/** 구간 이동 수단: 자차 → 자동차, 도보 위주 → 도보, 대중교통/미정 → 1.2km 이내는 도보, 그 이상은 대중교통 */
function modeOf(transport: TripSpec["transport"] | undefined, km: number): Mode {
  if (transport === "자차") return "car";
  if (transport === "도보 위주") return "walk";
  return km <= 1.2 ? "walk" : "traffic";
}

export const legKey = (leg: { from: { id: string }; to: { id: string } }) => `${leg.from.id}>${leg.to.id}`;

/** 직선거리 기반 대략적인 이동 시간(분). 실제 도로·환승을 고려해 보정한다. */
export function estimateMinutes(km: number, mode: Mode): number {
  const road = km * 1.3; // 직선 → 실제 경로 보정
  if (mode === "walk") return Math.max(1, Math.round((road / 4.5) * 60));
  if (mode === "car") return Math.round((road / 25) * 60) + 5; // 주차 등
  return Math.round((road / 18) * 60) + 10; // 대기·환승
}

export const MODE_LABEL: Record<Mode, string> = { walk: "도보", traffic: "대중교통", car: "자동차" };

function kakaoPoint(item: LocatedItem) {
  // 카카오맵 URL 스킴은 쉼표/슬래시를 구분자로 쓰므로 이름에서 제거한다
  return `${encodeURIComponent(item.name.replace(/[,/]/g, " "))},${item.lat},${item.lng}`;
}

export function legsOf(day: DayPlan, spec: TripSpec | null): (Leg & { mode: Mode })[] {
  const points = located(day.items);
  const max = spec?.max_travel_minutes ?? 30;
  return points.slice(1).map((to, i) => {
    const from = points[i];
    const km = distanceKm(from, to);
    const mode = modeOf(spec?.transport, km);
    const minutes = estimateMinutes(km, mode);
    return {
      from,
      to,
      km,
      mode,
      minutes,
      tooFar: minutes > max,
      directionsUrl: `https://map.kakao.com/link/by/${mode}/${kakaoPoint(from)}/${kakaoPoint(to)}`,
    };
  });
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}
