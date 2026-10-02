"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import { dayColor, legKey, located, placeOrder, type LocatedItem } from "@/lib/route";
import type { RoutedLeg } from "@/lib/useRoutedLegs";
import type { DayPlan } from "@/lib/types";

function numberIcon(n: number, bgClass: string, active: boolean) {
  // n = 0 은 숙소 (번호 대신 🏨)
  const label = n === 0 ? "🏨" : String(n);
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 font-bold shadow-lift transition-transform ${
      n === 0 ? "border-ink-300 bg-white text-sm" : `border-white text-xs text-white ${bgClass}`
    } ${active ? "scale-125 ring-4 ring-black/20" : ""}">${label}</div>`,
  });
}

/** 표시 대상이 바뀌면 모든 마커가 보이도록 지도 범위를 맞춘다 */
function FitBounds({ points }: { points: LocatedItem[] }) {
  const map = useMap();
  const key = points.map((p) => p.id).join(",");
  React.useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 16 });
    // key 가 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** 선택된 장소로 지도 이동 */
function FocusItem({ item }: { item: LocatedItem | undefined }) {
  const map = useMap();
  React.useEffect(() => {
    if (item) map.panTo([item.lat, item.lng], { animate: true });
  }, [item, map]);
  return null;
}

export default function RouteMap({
  days,
  legs,
  focusedId,
  onSelect,
}: {
  days: DayPlan[];
  legs: Map<number, RoutedLeg[]>;
  focusedId?: string | null;
  onSelect?: (itemId: string) => void;
}) {
  const all = days.flatMap((d) => located(d.items));
  const center: [number, number] = all.length ? [all[0].lat, all[0].lng] : [37.5665, 126.978];
  const focused = all.find((i) => i.id === focusedId);

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full" attributionControl>
      {/* OpenStreetMap 기본 타일: 키 없이 사용 가능 (CARTO 는 API 키가 필요해져 교체) */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={all} />
      <FocusItem item={focused} />
      {days.map((day) => {
        const color = dayColor(day.day);
        const points = located(day.items);
        return (
          <React.Fragment key={day.day}>
            {(legs.get(day.day) ?? []).map((leg) => (
              <Polyline
                // 실제 경로가 도착하면 새로 그린다 (Leaflet setStyle 은 빠진 dashArray 를 지우지 않음)
                key={`${legKey(leg)}-${leg.real ? "real" : "est"}`}
                positions={leg.real ? leg.real.geometry : [[leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]]}
                // 실제 경로는 실선, 경로를 못 구한 구간(대중교통 등)은 직선 점선
                pathOptions={
                  leg.real
                    ? { color: color.hex, weight: 5, opacity: 0.85 }
                    : { color: color.hex, weight: 3, opacity: 0.7, dashArray: "6 8" }
                }
              />
            ))}
            {points.map((p) => {
              const order = placeOrder(day, p.id);
              return (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={numberIcon(order, color.bg, p.id === focusedId)}
                  eventHandlers={{ click: () => onSelect?.(p.id) }}
                >
                  <Popup>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Day {day.day} · {order ? `${order}번째` : `숙소 ${p.memo}`} · {p.start_time}
                      </p>
                      <p className="text-sm font-semibold">{p.name}</p>
                      {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
