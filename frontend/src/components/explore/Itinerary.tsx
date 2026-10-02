"use client";

import * as React from "react";

import { ExternalLink } from "@/components/ui/icons";
import type { SharedPlan } from "@/lib/explore";
import { dayColor } from "@/lib/route";
import { categoryStyle } from "@/lib/styles";
import { cn } from "@/lib/utils";

/** 공유 계획 일정: Day 탭 + 세로 타임라인 */
export function Itinerary({ plan, regionName, overseas }: { plan: SharedPlan; regionName: string; overseas: boolean }) {
  const [day, setDay] = React.useState<number | "all">("all");
  const days = day === "all" ? plan.itinerary : plan.itinerary.filter((d) => d.day === day);

  const mapUrl = (name: string) => {
    const q = encodeURIComponent(`${regionName} ${name}`);
    return overseas ? `https://www.google.com/maps/search/?api=1&query=${q}` : `https://map.kakao.com/link/search/${q}`;
  };

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">여행 일정</h2>
        <span className="text-sm text-ink-500">{plan.itinerary.reduce((n, d) => n + d.places.length, 0)}곳</span>
      </div>

      {/* Day 탭 (스크롤해도 위에 붙어 있음) */}
      <div className="sticky top-14 z-10 -mx-4 bg-white/95 px-4 py-2 backdrop-blur lg:top-16 lg:mx-0 lg:px-0">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ key: "all" as const, label: "전체", dot: "" }, ...plan.itinerary.map((d) => ({ key: d.day, label: `Day ${d.day}`, dot: dayColor(d.day).bg }))].map(
            (t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setDay(t.key)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
                  day === t.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                )}
              >
                {t.dot && <span className={cn("h-2 w-2 rounded-full", t.dot)} />}
                {t.label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-10">
        {days.map((d) => {
          const color = dayColor(d.day);
          return (
            <div key={d.day} className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className={cn("rounded-lg px-2 py-1 text-xs font-bold", color.soft)}>Day {d.day}</span>
                <h3 className="text-[1.0625rem] font-bold tracking-tight">{d.title}</h3>
              </div>
              <ol className="relative space-y-3 pl-[4.5rem] before:absolute before:bottom-6 before:left-[3.69rem] before:top-6 before:border-l-2 before:border-dashed before:border-ink-200">
                {d.places.map((p, i) => {
                  const tone = categoryStyle(p.category);
                  const Icon = tone.icon;
                  return (
                    <li key={`${p.time}-${p.name}`} className="relative">
                      {/* 시간 + 순서 점 */}
                      <span className="absolute -left-[4.5rem] top-[1.1rem] w-10 text-right text-xs font-bold tabular-nums text-ink-500">{p.time}</span>
                      <span className={cn("absolute -left-[1.125rem] top-[1.3rem] h-3 w-3 rounded-full ring-[3px] ring-white", color.bg)} />
                      <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-inset ring-ink-200/70 transition-shadow hover:shadow-soft">
                        <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone.soft)}>
                          <Icon className="h-[18px] w-[18px]" />
                          <span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink-900 text-[0.625rem] font-bold text-white ring-2 ring-white">
                            {i + 1}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{p.name}</p>
                          <p className="truncate text-[0.8125rem] text-ink-500">
                            {p.category}
                            {p.note && <span className="text-ink-400"> · {p.note}</span>}
                          </p>
                        </div>
                        <a
                          href={mapUrl(p.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold",
                            overseas ? "bg-white text-[#1A73E8] ring-1 ring-inset ring-[#d2e3fc]" : "bg-[#FEE500] text-[#191919]"
                          )}
                        >
                          지도 <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
