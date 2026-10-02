"use client";

import * as React from "react";
import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { MapPin, Plus, Star, Trash2 } from "@/components/ui/icons";
import { ChipToggle } from "@/components/trip/chips";
import { PlaceSearch } from "@/components/trip/LodgingField";
import { MUST_VISIT_SLOTS, type MustVisitPlace } from "@/lib/types";

/**
 * 꼭 가야 하는 곳: 카카오에서 장소를 고르고, 여행 기간에 맞춰 며칠째·언제 갈지 정한다.
 * 날짜를 정하지 않으면 AI 가 알맞은 날에 넣는다.
 */
export function MustVisitField({
  value,
  onChange,
  region,
  days,
  startDate,
}: {
  value: MustVisitPlace[];
  onChange: (value: MustVisitPlace[]) => void;
  region: string;
  days: number;
  startDate: string | null;
}) {
  const [adding, setAdding] = React.useState(false);
  const dayLabel = (d: number) =>
    startDate ? `${d}일차 · ${format(addDays(parseISO(startDate), d - 1), "M/d(EEE)", { locale: ko })}` : `${d}일차`;
  const update = (idx: number, patch: Partial<MustVisitPlace>) => onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-3">
      {value.map((place, idx) => (
        <div key={`${place.place_url}-${idx}`} className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-butter-100 text-butter-700">
              <Star className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{place.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {place.address || "주소 없음 · AI가 이름으로 찾아요"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="꼭 갈 곳 삭제"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              <Trash2 />
            </Button>
          </div>

          {days > 1 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">언제 갈까요?</span>
              <div className="flex flex-wrap gap-1.5">
                <ChipToggle selected={place.day == null} onClick={() => update(idx, { day: null })} className="h-8 px-3 text-xs">
                  아무 날이나
                </ChipToggle>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <ChipToggle key={d} selected={place.day === d} onClick={() => update(idx, { day: d })} className="h-8 px-3 text-xs">
                    {dayLabel(d)}
                  </ChipToggle>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">시간대</span>
            <div className="flex flex-wrap gap-1.5">
              {MUST_VISIT_SLOTS.map((s) => (
                <ChipToggle key={s || "any"} selected={place.slot === s} onClick={() => update(idx, { slot: s })} className="h-8 px-3 text-xs">
                  {s || "상관없음"}
                </ChipToggle>
              ))}
            </div>
          </div>
        </div>
      ))}

      {adding ? (
        <PlaceSearch
          region={region}
          placeholder="가고 싶은 곳 검색 (예: 스타필드 하남 스몹)"
          onPick={(p) => {
            onChange([...value, { ...p, day: days > 1 ? null : 1, slot: "" }]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> {value.length ? "꼭 갈 곳 추가" : "꼭 가야 하는 곳 추가"}
        </Button>
      )}
    </div>
  );
}
