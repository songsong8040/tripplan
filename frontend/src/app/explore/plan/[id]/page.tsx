import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { PlanMetaTags, SharedPlanCard } from "@/components/explore/cards";
import { BookmarkButton } from "@/components/explore/BookmarkButton";
import { Itinerary } from "@/components/explore/Itinerary";
import { ShareLinkButton } from "@/components/explore/ShareLinkButton";
import { StartTripButton } from "@/components/explore/StartTripButton";
import { Toaster } from "@/components/trip/Toaster";
import { ArrowRight, Bus, CalendarDays, Car, ChevronRight, Footprints, Heart, Lightbulb, Users } from "@/components/ui/icons";
import { periodLabel, planById, plansByRegion, regionByKey, regionLabel, regionPillTone, SHARED_PLANS } from "@/lib/explore";
import { categoryStyle } from "@/lib/styles";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return SHARED_PLANS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const plan = planById((await params).id);
  return { title: plan ? `${plan.title} · tripplan` : "여행 계획 · tripplan" };
}

const TRANSPORT_ICON = { 자차: Car, 대중교통: Bus, "도보 위주": Footprints } as const;
const AVATAR_TONES = ["bg-mint-100 text-mint-700", "bg-sky-100 text-sky-700", "bg-lilac-100 text-lilac-700", "bg-peach-100 text-peach-700", "bg-butter-100 text-butter-700"];

/** 공유된 여행 계획 상세 (읽기 전용) */
export default async function SharedPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const plan = planById((await params).id);
  if (!plan) notFound();
  const region = regionByKey(plan.regionKey)!;
  const Transport = TRANSPORT_ICON[plan.transport];
  const others = plansByRegion(plan.regionKey).filter((p) => p.id !== plan.id).slice(0, 6);
  const places = plan.itinerary.flatMap((d) => d.places);
  const avatarTone = AVATAR_TONES[plan.author.charCodeAt(0) % AVATAR_TONES.length];

  // 어떤 곳을 얼마나 들르는지 (많은 순)
  const byCategory = Object.entries(
    places.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1]);

  const stats = [
    { label: "기간", value: periodLabel(plan), icon: CalendarDays, tone: "bg-sky-50 text-sky-600" },
    { label: "인원", value: `${plan.people}명`, icon: Users, tone: "bg-lilac-50 text-lilac-600" },
    { label: "이동", value: plan.transport, icon: Transport, tone: "bg-mint-50 text-mint-600" },
    { label: "1인 경비", value: plan.budget, icon: null, tone: "bg-peach-50 text-peach-600" },
  ];

  return (
    <Shell backHref={`/explore/${region.key}`} title={plan.title}>
      <div className="pb-24 lg:pb-0">
        {/* 대표 사진: 모바일은 화면 끝까지, PC는 둥근 카드 */}
        <section className="relative -mx-4 -mt-4 aspect-[16/10] overflow-hidden bg-ink-100 sm:mx-0 sm:mt-0 sm:aspect-[3/1] sm:rounded-[2rem]">
          <Image src={region.image} alt={`${region.name} 대표 이미지`} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
          <div className="absolute right-4 top-4 flex gap-2">
            <ShareLinkButton title={plan.title} />
            <BookmarkButton planId={plan.id} />
          </div>
          <Link
            href={`/explore/${region.key}`}
            className={cn("absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold shadow-soft", regionPillTone(region))}
          >
            <span>{region.flag}</span>
            {regionLabel(region)}
            <ChevronRight className="h-2.5 w-2.5 opacity-60" />
          </Link>
        </section>

        <div className="mt-6 grid items-start gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0 space-y-10">
            {/* 제목 · 작성자 */}
            <section className="space-y-4">
              <PlanMetaTags plan={plan} />
              <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{plan.title}</h1>
              <p className="text-[0.9375rem] leading-relaxed text-ink-600 sm:text-base">{plan.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.tags.map((t) => (
                  <span key={t} className="rounded-lg bg-ink-100 px-2.5 py-1 text-[0.8125rem] font-semibold text-ink-600">
                    #{t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t border-ink-100 pt-4">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold", avatarTone)}>
                  {plan.author.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{plan.author}</p>
                  <p className="text-[0.8125rem] text-ink-500">{plan.travelMonth}에 다녀왔어요</p>
                </div>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-50 px-3.5 text-sm font-bold text-rose-500">
                  <Heart className="h-3 w-3" />
                  {plan.likes.toLocaleString()}
                </span>
              </div>
            </section>

            {/* 한눈에 보기 */}
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3.5">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", tone)}>
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : "₩"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-ink-500">{label}</p>
                      <p className="truncate text-[0.9375rem] font-bold">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byCategory.map(([cat, n]) => {
                  const tone = categoryStyle(cat);
                  const Icon = tone.icon;
                  return (
                    <span key={cat} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold", tone.soft)}>
                      <Icon className="h-3 w-3" />
                      {cat} {n}
                    </span>
                  );
                })}
              </div>
            </section>

            <Itinerary plan={plan} regionName={region.name} overseas={region.overseas} />

            {/* 모바일: 팁은 일정 아래 */}
            <div className="lg:hidden">
              <Tips tips={plan.tips} author={plan.author} />
            </div>
          </div>

          {/* PC: 오른쪽에 붙어 따라오는 패널 */}
          <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            <div className="space-y-4 rounded-[1.75rem] bg-white p-6 shadow-soft ring-1 ring-inset ring-ink-100">
              <div className="space-y-1">
                <p className="text-lg font-bold leading-snug tracking-tight">이 계획, 우리 여행으로 가져갈까요?</p>
                <p className="text-sm leading-relaxed text-ink-500">링크로 친구를 부르고 AI 추천을 받아 함께 다듬어요.</p>
              </div>
              <StartTripButton label={`${region.name} 여행 만들기`} dark className="mt-0 w-full" />
            </div>
            <Tips tips={plan.tips} author={plan.author} />
          </aside>
        </div>

        {others.length > 0 && (
          <section className="mt-16 space-y-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight">{region.name}의 다른 계획</h2>
              <Link href={`/explore/${region.key}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
                더보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {others.map((p) => (
                <div key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)]">
                  <SharedPlanCard plan={p} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 모바일: 아래에 붙는 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-ink-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <BookmarkButton planId={plan.id} variant="plain" className="h-12 w-12 shrink-0" />
        <StartTripButton label="이 계획으로 여행 만들기" dark className="mt-0 h-12 flex-1" />
      </div>
      <Toaster />
    </Shell>
  );
}

/** 작성자 팁: 메모지 느낌의 노란 카드 */
function Tips({ tips, author }: { tips: string[]; author: string }) {
  if (!tips.length) return null;
  return (
    <section className="space-y-3 rounded-[1.75rem] bg-butter-50 p-5 ring-1 ring-inset ring-butter-100">
      <p className="inline-flex items-center gap-2 font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-butter-200 text-butter-700">
          <Lightbulb className="h-3 w-3" />
        </span>
        {author}님의 꿀팁
      </p>
      <ul className="space-y-2">
        {tips.map((t) => (
          <li key={t} className="flex gap-2 text-sm leading-relaxed text-ink-700">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-butter-500" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
