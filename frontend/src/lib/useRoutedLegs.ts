"use client";

import * as React from "react";

import { api } from "@/lib/api";
import { legKey, legsOf, type Mode } from "@/lib/route";
import type { DayPlan, RouteLegResult, TripSpec } from "@/lib/types";

type BaseLeg = ReturnType<typeof legsOf>[number];

export interface RoutedLeg extends BaseLeg {
  /** 실제 경로 조회 결과 (undefined = 조회 중/대상 아님, null = 경로를 못 구함) */
  real: RouteLegResult | null | undefined;
  isReal: boolean;
}

// 지도 패널이 여러 개(PC/모바일) 마운트돼도 같은 구간은 한 번만 조회한다
const cache = new Map<string, RouteLegResult | null>();

const signature = (leg: BaseLeg) => `${leg.mode}:${leg.from.lat},${leg.from.lng}>${leg.to.lat},${leg.to.lng}`;

const routable = (mode: Mode): mode is "car" | "walk" => mode === "car" || mode === "walk";

/** 일차별 구간 목록에 실제 경로(자동차/도보)의 거리·시간·경로선을 합친다. 대중교통 구간은 추정치 유지 */
export function useRoutedLegs(days: DayPlan[], spec: TripSpec | null): Map<number, RoutedLeg[]> {
  const base = React.useMemo(() => new Map(days.map((d) => [d.day, legsOf(d, spec)])), [days, spec]);
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const pending = [...base.values()].flat().filter((l) => routable(l.mode) && !cache.has(signature(l)));
  const pendingKey = pending.map(signature).join("|");

  React.useEffect(() => {
    if (!pending.length) return;
    let cancelled = false;
    api
      .route(
        pending.map((l) => ({
          mode: l.mode as "car" | "walk",
          start: { lat: l.from.lat, lng: l.from.lng },
          end: { lat: l.to.lat, lng: l.to.lng },
        }))
      )
      .then((results) => {
        pending.forEach((l, i) => cache.set(signature(l), results[i] ?? null));
        if (!cancelled) force();
      })
      .catch(() => {
        // 실패하면 추정치로 표시 (캐시하지 않아 다음에 다시 시도)
      });
    return () => {
      cancelled = true;
    };
    // pendingKey 가 바뀔 때만 다시 조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const max = spec?.max_travel_minutes ?? 30;
  return new Map(
    [...base.entries()].map(([day, legs]) => [
      day,
      legs.map((leg): RoutedLeg => {
        const real = routable(leg.mode) ? cache.get(signature(leg)) : undefined;
        if (!real) return { ...leg, real, isReal: false };
        const minutes = Math.max(1, Math.round(real.duration_s / 60));
        return { ...leg, real, isReal: true, km: real.distance_m / 1000, minutes, tooFar: minutes > max };
      }),
    ])
  );
}

export { legKey };
