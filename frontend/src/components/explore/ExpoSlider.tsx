"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";

import { ArrowRight, ChevronLeft, ChevronRight, Heart, Plus } from "@/components/ui/icons";
import { BookmarkButton } from "@/components/explore/BookmarkButton";
import { PlanMetaTags } from "@/components/explore/cards";
import { regionByKey, regionLabel, regionPillTone, SHARED_PLANS, type SharedPlan } from "@/lib/explore";
import { cn } from "@/lib/utils";

const SHARED_COUNT = SHARED_PLANS.length;
const SLIDE = "min-w-0 shrink-0 grow-0 basis-[76%] pl-3 sm:basis-[46%] lg:basis-[48%] xl:basis-[42%]";

/**
 * Expo 스타일 슬라이더: 가운데 카드는 크게, 양옆 카드는 작고 흐리게.
 * 무한 순환(1 ↔ 마지막)이고, 마지막 카드는 '모든 여행 계획 보기'.
 */
export function ExpoSlider({ plans }: { plans: SharedPlan[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "center", loop: true });
  const [selected, setSelected] = React.useState(0);
  const total = plans.length + 1;

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi]);

  const slideClass = (i: number) =>
    cn("h-full transition-all duration-500 ease-out", i === selected ? "scale-100 opacity-100" : "scale-[0.88] opacity-60");

  // 옆 카드를 누르면 이동 대신 그 카드로 넘긴다
  const guard = (i: number) => (e: React.MouseEvent) => {
    if (i !== selected) {
      e.preventDefault();
      emblaApi?.scrollTo(i);
    }
  };

  return (
    <div className="relative">
      {/* 양끝은 흐리게 사라지도록 마스크 */}
      <div
        ref={emblaRef}
        className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]"
      >
        <div className="-ml-3 flex touch-pan-y">
          {plans.map((plan, i) => {
            const region = regionByKey(plan.regionKey);
            return (
              <div key={plan.id} className={SLIDE}>
                <Link
                  href={`/explore/plan/${plan.id}`}
                  onClick={guard(i)}
                  className={cn("group relative block aspect-[4/5] sm:aspect-square overflow-hidden lg:aspect-[16/10] rounded-[2rem] bg-ink-100 text-left", slideClass(i))}
                >
                  {region && (
                    <Image
                      src={region.image}
                      alt={`${region.name} 대표 이미지`}
                      fill
                      sizes="(max-width: 640px) 76vw, (max-width: 1024px) 46vw, 48vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      priority={i < 3}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold shadow-soft", regionPillTone(region))}>{region ? regionLabel(region) : ""}</span>
                    <BookmarkButton planId={plan.id} />
                  </div>
                  {/* 카드 글은 왼쪽 정렬 (사진 카드 기본) */}
                  <div className="absolute inset-x-0 bottom-0 space-y-1 p-5 text-white">
                    <PlanMetaTags plan={plan} variant="overlay" className="pb-1" />
                    <h3 className="text-3xl font-bold leading-tight tracking-tight">{plan.title}</h3>
                    <div className="flex items-center justify-between gap-3 pt-1 text-[0.8125rem] leading-none text-white/80">
                      <span className="truncate text-lg leading-normal">{plan.tags.map((t) => `#${t}`).join("  ")}</span>
                      {/* 하트·숫자 세로 가운데 정렬 */}
                      <span className="inline-flex h-5 shrink-0 items-center gap-1 font-semibold leading-none text-white">
                        {/* 하트 모양은 위쪽이 무거워 보여 살짝 내려 시각적 가운데를 맞춘다 */}
                        <Heart className="block h-2.5 w-2.5 translate-y-[0.5px] text-white" />
                        <span className="leading-none">{plan.likes}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}

          {/* 마지막 카드: 전체 보기 */}
          <div className={SLIDE}>
            <Link
              href="/explore"
              onClick={guard(total - 1)}
              className={cn(
                "group relative flex aspect-[4/5] sm:aspect-square flex-col lg:aspect-[16/10] items-center justify-center gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-lilac-100 via-sky-100 to-mint-100 p-6 text-center text-ink-900",
                slideClass(total - 1)
              )}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lift transition-transform duration-300 group-hover:rotate-90">
                <Plus className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <h3 className="text-xl font-bold leading-snug tracking-tight">모든 여행 계획 둘러보기</h3>
                <p className="text-sm text-ink-600">{SHARED_COUNT}개의 계획이 기다리고 있어요</p>
              </div>
              <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">
                전체 보기 <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* 컨트롤: 무한 순환이라 양쪽 화살표 항상 사용 가능 */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="이전"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-900 shadow-soft transition hover:bg-ink-900 hover:text-white"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 카드`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn("h-1.5 rounded-full transition-all", i === selected ? "w-5 bg-ink-900" : "w-1.5 bg-ink-900/25 hover:bg-ink-900/50")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="다음"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-900 shadow-soft transition hover:bg-ink-900 hover:text-white"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
