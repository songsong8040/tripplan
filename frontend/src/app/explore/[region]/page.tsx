import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { RegionButtons, SharedPlanCard, SortTabs } from "@/components/explore/cards";
import { StartTripButton } from "@/components/explore/StartTripButton";
import { Toaster } from "@/components/trip/Toaster";
import { ArrowRight, CalendarCheck, Users } from "@/components/ui/icons";
import { plansByRegion, regionByKey, regionPillTone, REGIONS, sortPlans } from "@/lib/explore";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return REGIONS.map((r) => ({ region: r.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }) {
  const region = regionByKey((await params).region);
  return { title: region ? `${region.name} 여행 계획 · tripplan` : "여행 계획 · tripplan" };
}

/** 여행지별 공유 여행 계획 목록 */
export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const region = regionByKey((await params).region);
  if (!region) notFound();
  const plans = sortPlans(plansByRegion(region.key), sort);

  return (
    <Shell backHref="/" title={`${region.name} 여행 계획`}>
      <div className="space-y-10">
        {/* 대표 이미지 히어로: 사진은 선명하게, 글은 왼쪽 아래에 */}
        <section className="relative -mx-4 -mt-4 overflow-hidden bg-ink-900 sm:mx-0 sm:mt-0 sm:rounded-[2rem]">
          <Image src={region.image} alt={`${region.name} 대표 이미지`} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/5" />
          <div className="relative flex min-h-[20rem] flex-col justify-end gap-5 p-6 text-white sm:min-h-[24rem] sm:flex-row sm:items-end sm:justify-between sm:p-10">
            <div className="space-y-3">
              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold shadow-soft", regionPillTone(region))}>
                {region.overseas ? `해외 · ${region.country}` : "국내"}
              </span>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{region.name}</h1>
              <p className="text-[0.9375rem] text-white/85 sm:text-lg">{region.tagline}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/15 px-3 text-xs font-semibold backdrop-blur-md">
                  <CalendarCheck className="h-3 w-3" /> 누적 계획 {region.planCount}개
                </span>
                <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/15 px-3 text-xs font-semibold backdrop-blur-md">
                  <Users className="h-3 w-3" /> 공유된 계획 {plans.length}개
                </span>
              </div>
            </div>
            <StartTripButton
              label="이 여행지로 계획 만들기"
              className="mt-0 h-12 shrink-0 self-start rounded-full bg-white px-5 text-[0.9375rem] text-ink-900 shadow-soft hover:bg-ink-50 sm:self-end"
            />
          </div>
        </section>

        <RegionButtons regions={REGIONS} active={region.key} />

        <section className="space-y-5">
          <h2 className="text-center text-xl font-bold tracking-tight sm:text-2xl">
            {region.name}에서 공유된 계획 <span className={region.overseas ? "text-lilac-600" : "text-rose-500"}>{plans.length}</span>
          </h2>
          <SortTabs basePath={`/explore/${region.key}`} active={sort} count={plans.length} />
          {plans.length ? (
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <SharedPlanCard key={p.id} plan={p} />
              ))}
            </div>
          ) : (
            <p className="rounded-3xl bg-ink-50 py-14 text-center text-sm text-ink-500">아직 공유된 계획이 없어요.</p>
          )}
          <div className="flex justify-center pt-2">
            <Link
              href="/explore"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
            >
              다른 여행지 계획도 보기 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
      <Toaster />
    </Shell>
  );
}
