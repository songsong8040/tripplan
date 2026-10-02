"use client";

import * as React from "react";
import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { BedDouble, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipToggle } from "@/components/trip/chips";
import { api } from "@/lib/api";
import type { Lodging, PlaceSearchResult } from "@/lib/types";

type PickedPlace = Pick<Lodging, "name" | "address" | "place_url" | "lat" | "lng">;

/** 숙소 이름으로 카카오 검색 → 선택, 결과가 없으면 이름만 직접 입력 */
function LodgingSearch({
  region,
  onPick,
  onCancel,
}: {
  region: string;
  onPick: (place: PickedPlace) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);

  // 입력이 멈추면 검색 (디바운스)
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchPlaces(q, region)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, region]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="pl-11 pr-10"
          placeholder="숙소 이름으로 검색 (예: 리버파크호텔)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault();
          }}
        />
        {searching && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length >= 2 && (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-2xl border bg-card">
          {results.map((r) => (
            <li key={r.place_url || r.name}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="text-sm font-medium">
                  {r.name} <span className="text-xs font-normal text-muted-foreground">{r.category}</span>
                </span>
                <span className="text-xs text-muted-foreground">{r.address}</span>
              </button>
            </li>
          ))}
          {!searching && (
            <li>
              <button
                type="button"
                onClick={() => onPick({ name: query.trim(), address: "", place_url: "", lat: null, lng: null })}
                className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                {results.length === 0 && "검색 결과가 없어요. "}
                &lsquo;<b className="text-foreground">{query.trim()}</b>&rsquo; 이름으로 직접 입력
              </button>
            </li>
          )}
        </ul>
      )}
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
      )}
    </div>
  );
}

/**
 * 이미 예약한 숙소들을 밤별로 지정한다.
 * 한 밤에는 숙소 하나만 지정되며, 다른 숙소에서 그 밤을 고르면 기존 숙소에서는 빠진다.
 */
export function LodgingsField({
  value,
  onChange,
  region,
  nights,
  startDate,
}: {
  value: Lodging[];
  onChange: (value: Lodging[]) => void;
  region: string;
  nights: number;
  startDate: string | null;
}) {
  const [adding, setAdding] = React.useState(false);
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const allNights = Array.from({ length: nights }, (_, i) => i + 1);

  const nightLabel = (n: number) =>
    startDate ? `${format(addDays(parseISO(startDate), n - 1), "M/d(EEE)", { locale: ko })} 밤` : `${n}일차 밤`;

  const assigned = new Set(value.flatMap((l) => l.nights.filter((n) => n <= nights)));
  const unassigned = allNights.filter((n) => !assigned.has(n));

  const update = (idx: number, patch: Partial<Lodging>) => onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const toggleNight = (idx: number, night: number) => {
    const has = value[idx].nights.includes(night);
    onChange(
      value.map((l, i) => {
        if (i === idx) return { ...l, nights: has ? l.nights.filter((n) => n !== night) : [...l.nights, night].sort((a, b) => a - b) };
        return has ? l : { ...l, nights: l.nights.filter((n) => n !== night) }; // 한 밤 = 숙소 하나
      })
    );
  };

  const add = (place: PickedPlace) => {
    onChange([...value, { ...place, check_in: "15:00", check_out: "11:00", nights: unassigned }]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {value.map((lodging, idx) => (
        <div key={idx} className="space-y-3 rounded-2xl border bg-card p-4">
          {editingIdx === idx ? (
            <LodgingSearch
              region={region}
              onPick={(place) => {
                update(idx, place);
                setEditingIdx(null);
              }}
              onCancel={() => setEditingIdx(null)}
            />
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <BedDouble className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{lodging.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {lodging.address || "주소 없음 · 지도에는 표시되지 않아요"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="숙소 변경" onClick={() => setEditingIdx(idx)}>
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="숙소 삭제"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
              >
                <Trash2 />
              </Button>
            </div>
          )}

          {nights > 1 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">묵는 밤</span>
              <div className="flex flex-wrap gap-1.5">
                {allNights.map((n) => (
                  <ChipToggle key={n} selected={lodging.nights.includes(n)} onClick={() => toggleNight(idx, n)} className="h-8 px-3 text-xs">
                    {nightLabel(n)}
                  </ChipToggle>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">체크인</span>
              <Input type="time" value={lodging.check_in} onChange={(e) => update(idx, { check_in: e.target.value || "15:00" })} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">체크아웃</span>
              <Input type="time" value={lodging.check_out} onChange={(e) => update(idx, { check_out: e.target.value || "11:00" })} />
            </div>
          </div>
        </div>
      ))}

      {adding ? (
        <LodgingSearch region={region} onPick={add} onCancel={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> {value.length ? "숙소 추가" : "예약한 숙소 추가"}
        </Button>
      )}

      {value.length > 0 && unassigned.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {unassigned.map(nightLabel).join(", ")}은 숙소가 정해지지 않았어요. 필요하면 숙소를 추가하거나 묵는 밤을 골라 주세요.
        </p>
      )}
    </div>
  );
}
