"use client";

import Image from "next/image";
import { format, parseISO } from "date-fns";

import { Avatar, ShareButton } from "@/components/trip/people";
import { joinedLabel } from "@/components/trip/TripSteps";
import { Bus, CalendarDays, Car, Footprints, Users } from "@/components/ui/icons";
import { REGIONS, regionPillTone } from "@/lib/explore";
import { tripDDay } from "@/lib/format";
import type { Trip, TripSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

function periodLabel(spec: TripSpec): string {
  const nights = spec.nights ? `${spec.nights}박 ${spec.days}일` : "당일치기";
  if (spec.duration_mode !== "exact" || !spec.start_date) return nights;
  const start = format(parseISO(spec.start_date), "M.d");
  const end = spec.end_date && spec.end_date !== spec.start_date ? `–${format(parseISO(spec.end_date), "M.d")}` : "";
  return `${start}${end} · ${nights}`;
}

/**
 * 여행 방 상단: 여행지 사진 위에 제목·요약·멤버.
 * 둘러보기에 없는 여행지는 파스텔 그라데이션으로 대신한다.
 */
export function TripHero({ trip, spec, title }: { trip: Trip; spec: TripSpec; title: string }) {
  const region = REGIONS.find((r) => spec.region.includes(r.name));
  const badge = tripDDay(spec);
  const Transport = spec.transport === "자차" ? Car : spec.transport === "도보 위주" ? Footprints : Bus;
  const chips = [
    { icon: CalendarDays, label: periodLabel(spec) },
    { icon: Users, label: joinedLabel(trip) },
    ...(spec.transport !== "미정" ? [{ icon: Transport, label: `${spec.transport} · ${spec.max_travel_minutes}분 이내` }] : []),
  ];
  const shown = trip.participants.slice(0, 5);
  const rest = trip.participants.length - shown.length;

  return (
    <section className="relative -mx-4 -mt-5 overflow-hidden bg-ink-900 sm:mx-0 sm:mt-0 sm:rounded-[2rem]">
      {region ? (
        <Image src={region.image} alt={`${region.name} 대표 이미지`} fill priority sizes="100vw" className="object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-lilac-400 via-sky-400 to-mint-400" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />

      <div className="relative flex min-h-[13rem] flex-col justify-end gap-5 p-5 text-white sm:min-h-[14rem] sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold shadow-soft", regionPillTone(region))}>{spec.region}</span>
            {badge && <span className={cn("rounded-full px-3 py-1 text-xs font-bold shadow-soft", badge.tone)}>{badge.label}</span>}
          </div>
          <h1 className="text-balance text-[1.875rem] font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
          <div className="flex flex-wrap gap-1.5">
            {chips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold backdrop-blur-md"
              >
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* 함께하는 사람들 + 초대 */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex -space-x-2">
            {shown.map((p) => (
              <Avatar key={p.id} person={p} className="h-9 w-9 ring-white" />
            ))}
            {rest > 0 && (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-ink-700 ring-2 ring-white">
                +{rest}
              </span>
            )}
          </div>
          <ShareButton
            label="친구 초대"
            className="h-10 rounded-full bg-white px-4 text-ink-900 ring-0 shadow-soft hover:bg-ink-50"
          />
        </div>
      </div>
    </section>
  );
}
