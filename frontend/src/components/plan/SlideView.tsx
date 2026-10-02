"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Clock, MapPin, ThumbsUp, X } from "@/components/ui/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { businessStatus, dayLabel, endTime, formatDuration } from "@/lib/format";
import { mapLinks } from "@/lib/links";
import type { DayPlan, PlanItem, PlanOption, TripSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "cover" }
  | { kind: "day"; day: DayPlan }
  | { kind: "place"; day: DayPlan; item: PlanItem; index: number };

function buildSlides(plan: PlanOption): Slide[] {
  const slides: Slide[] = [{ kind: "cover" }];
  for (const day of plan.days) {
    slides.push({ kind: "day", day });
    day.items.forEach((item, index) => slides.push({ kind: "place", day, item, index }));
  }
  return slides;
}

// 카드 뉴스 배경 톤 (일차별로 순환)
const DAY_TONES = [
  "from-lilac-100 to-white",
  "from-mint-100 to-white",
  "from-peach-100 to-white",
  "from-sky-100 to-white",
  "from-butter-100 to-white",
];

function SlideFrame({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center px-4 sm:px-10">
      <div
        className={cn(
          "flex aspect-[4/5] max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-ink-200/60 bg-gradient-to-b p-7 shadow-lift sm:p-9",
          tone
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SlideContent({ slide, plan, spec }: { slide: Slide; plan: PlanOption; spec: TripSpec | null }) {
  if (slide.kind === "cover") {
    return (
      <SlideFrame tone="from-ink-100 to-white">
        <Badge variant="default" className="self-start">
          {plan.label}
        </Badge>
        <div className="mt-auto space-y-4">
          <p className="text-sm font-medium text-muted-foreground">{spec?.title || spec?.region}</p>
          <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{plan.title}</h2>
          <p className="text-balance text-sm leading-relaxed text-foreground/70">{plan.concept}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-1.5">
          {plan.days.map((d) => (
            <Badge key={d.day} variant="outline" className="bg-card/60">
              Day {d.day} · {d.items.length}곳
            </Badge>
          ))}
        </div>
      </SlideFrame>
    );
  }

  const tone = DAY_TONES[(slide.day.day - 1) % DAY_TONES.length];

  if (slide.kind === "day") {
    return (
      <SlideFrame tone={tone}>
        <p className="text-sm font-semibold uppercase tracking-widest text-foreground/60">{dayLabel(slide.day)}</p>
        <h2 className="mt-3 text-balance text-3xl font-bold leading-tight tracking-tight">
          {slide.day.title || `${slide.day.day}일차`}
        </h2>
        <ol className="mt-auto space-y-2.5">
          {slide.day.items.slice(0, 7).map((item) => (
            <li key={item.id} className="flex items-baseline gap-3 text-sm">
              <span className="w-11 shrink-0 font-semibold tabular-nums">{item.start_time}</span>
              <span className="truncate">{item.name}</span>
            </li>
          ))}
          {slide.day.items.length > 7 && (
            <li className="text-xs text-muted-foreground">외 {slide.day.items.length - 7}곳</li>
          )}
        </ol>
      </SlideFrame>
    );
  }

  const { item, day, index } = slide;
  const status = businessStatus(item, day.date);
  const likes = Object.values(item.votes).filter((v) => v === "like").length;
  const end = endTime(item);
  return (
    <SlideFrame tone={tone}>
      <div className="flex items-center justify-between text-xs font-medium text-foreground/60">
        <span>
          Day {day.day} · {index + 1}/{day.items.length}
        </span>
        <Badge variant="secondary" className="bg-card/70">
          {item.category}
        </Badge>
      </div>
      <div className="mt-auto space-y-4">
        <p className="flex items-center gap-1.5 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
          {item.start_time || "--:--"}
        </p>
        <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{item.name}</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/70">
          {item.area && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.area}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {end ? `~${end} · ` : ""}
            {formatDuration(item.duration_minutes)}
          </span>
          {likes > 0 && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {likes}
            </span>
          )}
        </div>
        {item.reason && <p className="line-clamp-4 text-sm leading-relaxed text-foreground/80">{item.reason}</p>}
        {item.memo && <p className="line-clamp-2 rounded-2xl bg-card/70 px-3 py-2 text-xs">📝 {item.memo}</p>}
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-foreground/60">{status.kind !== "unknown" ? status.label : ""}</span>
        <a
          href={mapLinks(item).naver}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground"
        >
          지도 보기
        </a>
      </div>
    </SlideFrame>
  );
}

/** 카드 뉴스 형태로 전체 일정을 넘겨보는 전체 화면 프레젠테이션 뷰 */
export function SlideView({
  plan,
  spec,
  open,
  onOpenChange,
}: {
  plan: PlanOption;
  spec: TripSpec | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const slides = React.useMemo(() => buildSlides(plan), [plan]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, emblaApi]);

  // 일차 바로가기: 각 day 슬라이드의 인덱스
  const dayStarts = slides.flatMap((s, i) => (s.kind === "day" ? [{ day: s.day.day, index: i }] : []));
  const currentDay = [...dayStarts].reverse().find((d) => d.index <= index)?.day;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="inset-0 flex h-dvh max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-ink-50 p-0 sm:inset-0 sm:m-0 sm:h-dvh sm:max-w-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">{plan.title} 슬라이드 보기</DialogTitle>
        <DialogDescription className="sr-only">좌우로 넘겨 일정을 확인하세요.</DialogDescription>

        <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {dayStarts.map((d) => (
              <button
                key={d.day}
                type="button"
                onClick={() => emblaApi?.scrollTo(d.index)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors",
                  currentDay === d.day ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                )}
              >
                Day {d.day}
              </button>
            ))}
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1} / {slides.length}
          </span>
          <Button variant="secondary" size="icon" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full py-4">
              {slides.map((slide, i) => (
                <SlideContent key={i} slide={slide} plan={plan} spec={spec} />
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full sm:inline-flex"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={index === 0}
            aria-label="이전"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full sm:inline-flex"
            onClick={() => emblaApi?.scrollNext()}
            disabled={index === slides.length - 1}
            aria-label="다음"
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
          <progress
            value={index + 1}
            max={slides.length}
            aria-label="슬라이드 진행률"
            className="mx-auto block h-1 w-full max-w-md appearance-none overflow-hidden rounded-full bg-ink-200 [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-ink-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-all"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
