"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { ExpoSlider } from "@/components/explore/ExpoSlider";
import { PlanSearch, RegionButtons } from "@/components/explore/cards";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "@/components/ui/icons";
import { Toaster } from "@/components/trip/Toaster";
import { api, ApiError } from "@/lib/api";
import { featuredPlans, popularRegions } from "@/lib/explore";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";

function SectionHeader({ title }: { title: string }) {
  return <h2 className="pb-3 text-center text-[1.625rem] font-bold tracking-tight sm:pb-4 sm:text-3xl">{title}</h2>;
}

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  // 히어로 버튼이 화면 밖으로 나가면 오른쪽 아래 떠 있는 버튼으로 (PC·태블릿)
  const heroActions = React.useRef<HTMLDivElement>(null);
  const [showFab, setShowFab] = React.useState(false);
  React.useEffect(() => {
    const el = heroActions.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowFab(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const { id } = await api.createTrip();
      router.push(`/trip/${id}`);
    } catch (e) {
      toast.error((e as ApiError).message);
      setCreating(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-16 text-center sm:space-y-24">
        {/* 히어로 */}
        <section className="mx-auto max-w-2xl space-y-5 pt-6 sm:pt-16 lg:max-w-4xl">
          <h1 className="text-[2.125rem] font-bold leading-[1.25] tracking-tighter sm:text-5xl sm:leading-[1.2]">
            {/* PC는 한 줄, 좁은 화면은 쉼표 뒤에서 줄바꿈 */}
            친구들과 여행 계획, <br className="lg:hidden" />
            링크 하나로 끝내요
          </h1>
          <p className="text-[0.9375rem] leading-relaxed text-ink-600 sm:text-lg">
            조건만 모으면 AI가 실제 있는 장소로 일정을 짜줘요.
            <br className="hidden sm:block" /> 투표하고 고치면서 함께 완성하세요.
          </p>
          <div ref={heroActions} className="hidden items-center justify-center gap-2 pt-3 sm:flex">
            <Button size="lg" onClick={create} disabled={creating} className="min-w-40">
              {creating && <Loader2 className="animate-spin" />}
              여행 만들기
            </Button>
            <Button size="lg" variant="secondary" asChild className="min-w-40">
              <Link href="/explore">계획 둘러보기</Link>
            </Button>
          </div>
          <p className="hidden text-[0.8125rem] text-ink-400 sm:block">로그인 없이 바로 시작할 수 있어요</p>
          <PlanSearch size="lg" className="pt-4" />
        </section>

        {/* 많이 계획한 여행지 */}
        <section className="space-y-5">
          <SectionHeader title="많이 계획한 여행지" />
<RegionButtons regions={popularRegions(9)} grouped={false} moreHref="/explore" />
        </section>

        {/* 공유된 여행 계획 */}
        <section className="relative isolate space-y-6">
          <SectionHeader title="다른 사람들의 여행 계획" />
          <div className="-mx-4 sm:-mx-6 lg:-mx-10 2xl:-mx-14">
            {/* 가운데 카드 뒤로 아주 연하게 퍼지는 회색 원 */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[55%] -z-10 aspect-square w-[min(110vw,52rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,theme(colors.ink.200)_0%,theme(colors.ink.200/80%)_30%,theme(colors.ink.100/70%)_52%,transparent_70%)] blur-2xl"
            />
            <ExpoSlider plans={featuredPlans(8)} />
          </div>
        </section>

      </div>

      {/* 모바일: 하단 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-ink-100 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:hidden">
        <Button size="lg" variant="secondary" asChild className="flex-1">
          <Link href="/explore">둘러보기</Link>
        </Button>
        <Button size="lg" onClick={create} disabled={creating} className="flex-[2]">
          {creating && <Loader2 className="animate-spin" />}
          여행 만들기
        </Button>
      </div>
      <div className="h-24 sm:hidden" />

      {/* PC·태블릿: 스크롤로 히어로 버튼이 안 보이면 떠 있는 버튼 */}
      <button
        type="button"
        onClick={create}
        disabled={creating}
        aria-hidden={!showFab}
        tabIndex={showFab ? 0 : -1}
        className={cn(
          "fixed bottom-6 right-6 z-30 hidden h-11 items-center gap-1.5 rounded-full bg-ink-900 pl-4 pr-5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(25,31,40,0.45)] transition-all duration-300 hover:bg-ink-800 active:scale-95 disabled:opacity-60 sm:inline-flex",
          showFab ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3 w-3" />}
        여행 만들기
      </button>
      <Toaster />
    </Shell>
  );
}
