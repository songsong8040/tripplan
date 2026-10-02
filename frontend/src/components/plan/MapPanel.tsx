"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, ArrowRight, Bus, Car, Footprints, Loader2, MapIcon, MapPinned, Navigation } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { dayLabel } from "@/lib/format";
import { dayColor, formatKm, located, MODE_LABEL, placeOrder } from "@/lib/route";
import { useRoutedLegs, type RoutedLeg } from "@/lib/useRoutedLegs";
import { DirectionsDialog, type DirectionsTarget } from "@/components/plan/DirectionsDialog";
import { useTripStore } from "@/lib/store";
import type { DayPlan, PlanOption, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

// Leaflet 은 window 를 쓰므로 클라이언트에서만 불러온다
const RouteMap = dynamic(() => import("@/components/plan/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

let kakaoEnabledCache: boolean | null = null;

function useKakaoEnabled() {
  const [enabled, setEnabled] = React.useState<boolean | null>(kakaoEnabledCache);
  React.useEffect(() => {
    if (kakaoEnabledCache !== null) return;
    api
      .health()
      .then((h) => {
        kakaoEnabledCache = h.kakao;
        setEnabled(h.kakao);
      })
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

const MODE_ICON = { car: Car, walk: Footprints, traffic: Bus } as const;

function RouteLegs({
  day,
  trip,
  legs,
  onFocus,
  onDirections,
}: {
  day: DayPlan;
  trip: Trip;
  legs: RoutedLeg[];
  onFocus: (id: string) => void;
  onDirections: (target: DirectionsTarget) => void;
}) {
  const color = dayColor(day.day);
  if (!legs.length) return null;
  const total = legs.reduce((sum, l) => sum + l.minutes, 0);
  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between text-xs font-semibold">
        <span className={color.text}>{dayLabel(day)}</span>
        <span className="font-normal text-muted-foreground">
          {trip.spec?.transport === "자차" ? "🚗 운전" : "이동"} 합계 약 {total}분
        </span>
      </p>
      <ol className="space-y-1">
        {legs.map((leg) => {
          const fromNo = placeOrder(day, leg.from.id) || "🏨";
          const toNo = placeOrder(day, leg.to.id) || "🏨";
          const Icon = MODE_ICON[leg.mode];
          return (
            <li
              key={`${leg.from.id}-${leg.to.id}`}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-3 py-2 text-xs",
                leg.tooFar ? "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100" : "bg-white ring-1 ring-inset ring-ink-200/70"
              )}
            >
              <button
                type="button"
                onClick={() => onFocus(leg.to.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className="font-semibold tabular-nums">{fromNo}</span>
                <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
                <span className="font-semibold tabular-nums">{toNo}</span>
                <span className="truncate text-muted-foreground">{leg.to.name}</span>
              </button>
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                <Icon className="h-3.5 w-3.5" aria-label={MODE_LABEL[leg.mode]} />
                {leg.isReal ? "" : "약 "}
                {leg.minutes}분 · {formatKm(leg.km)}
                {!leg.isReal && <span className="text-muted-foreground/70">(추정)</span>}
              </span>
              {leg.tooFar && (
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-label={`설정한 최대 이동 시간(${trip.spec?.max_travel_minutes ?? 30}분)보다 멀어요`}
                />
              )}
              <button
                type="button"
                onClick={() =>
                  onDirections({
                    from: { name: leg.from.name, lat: leg.from.lat, lng: leg.from.lng },
                    to: { name: leg.to.name, lat: leg.to.lat, lng: leg.to.lng },
                    mode: leg.mode,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 font-semibold text-white hover:bg-ink-700"
              >
                <Navigation className="h-3 w-3" />
                길찾기
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 선택한 플랜/일차의 장소를 지도에 표시하고 구간별 이동 거리·시간·길찾기 링크를 보여준다 */
export function MapPanel({
  trip,
  plan,
  dayFilter,
  focusedId,
  onFocus,
  className,
  framed,
}: {
  trip: Trip;
  plan: PlanOption;
  dayFilter: number | "all";
  focusedId: string | null;
  onFocus: (id: string) => void;
  className?: string;
  /** PC 사이드 패널처럼 테두리·제목이 있는 카드로 감쌀지 */
  framed?: boolean;
}) {
  const kakao = useKakaoEnabled();
  const mutate = useTripStore((s) => s.mutate);
  const [locating, setLocating] = React.useState(false);

  const days = dayFilter === "all" ? plan.days : plan.days.filter((d) => d.day === dayFilter);
  const items = days.flatMap((d) => d.items).filter((i) => i.category !== "이동");
  const pinned = located(items).length;
  const missing = items.length - pinned;

  const locate = async () => {
    setLocating(true);
    await mutate((token) => api.locate(trip.id, token), "지도 위치를 불러왔어요");
    setLocating(false);
  };

  const routed = useRoutedLegs(days, trip.spec);
  const [directions, setDirections] = React.useState<DirectionsTarget | null>(null);
  const tooFar = [...routed.values()].flat().filter((l) => l.tooFar).length;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",

        className
      )}
    >
      {framed && (
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sky-600 shadow-soft">
            <MapIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold">지도 · 동선</span>
          <span className="ml-auto text-xs font-medium text-ink-400">{plan.label}</span>
        </div>
      )}
      <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-[1.25rem] border border-ink-200/80 bg-ink-50">
        {pinned > 0 && <RouteMap days={days} legs={routed} focusedId={focusedId} onSelect={onFocus} />}
        {pinned === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <MapPinned className="h-8 w-8 text-muted-foreground" />
            {kakao === false ? (
              <p className="max-w-xs text-sm text-muted-foreground">
                장소 좌표를 찾으려면 백엔드 <code>.env</code>에 <b>KAKAO_REST_API_KEY</b>를 설정해 주세요.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">아직 지도에 표시할 위치 정보가 없어요.</p>
                <Button size="sm" onClick={locate} disabled={locating || kakao === null}>
                  {locating && <Loader2 className="animate-spin" />}
                  지도 위치 불러오기
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {pinned > 0 && (missing > 0 || tooFar > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {missing > 0 && (
            <span className="flex items-center gap-1.5">
              {missing}곳은 위치를 찾지 못해 지도에 없어요.
              {kakao && (
                <button type="button" onClick={locate} disabled={locating} className="font-medium text-foreground underline">
                  다시 찾기
                </button>
              )}
            </span>
          )}
          {tooFar > 0 && (
            <span className="flex items-center gap-1 text-rose-600">
              <AlertTriangle className="h-3 w-3" /> {tooFar}개 구간이 설정한 {trip.spec?.max_travel_minutes ?? 30}분보다 멀어요
            </span>
          )}
        </div>
      )}

      {pinned > 1 && (
        <div className="max-h-[38%] space-y-3 overflow-y-auto pr-1">
          {days.map((d) => (
            <RouteLegs key={d.day} day={d} trip={trip} legs={routed.get(d.day) ?? []} onFocus={onFocus} onDirections={setDirections} />
          ))}
          <p className="text-[0.6875rem] text-muted-foreground/80">
            {trip.spec?.transport === "자차"
              ? "자동차 시간은 카카오내비 실시간 경로 기준이에요."
              : "도보 구간은 실제 보행 경로 기준이고, 대중교통 구간은 직선거리 추정치예요."}{" "}
            정확한 경로는 &lsquo;길찾기&rsquo;에서 원하는 지도 앱으로 확인하세요.
          </p>
        </div>
      )}
      <DirectionsDialog target={directions} onOpenChange={(open) => !open && setDirections(null)} />
    </div>
  );
}
