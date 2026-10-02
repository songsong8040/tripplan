import { Shell } from "@/components/layout/Shell";
import { AreaTabs, PlanSearch, RegionButtons, SortTabs } from "@/components/explore/cards";
import { EmptySearch } from "@/components/explore/EmptySearch";
import { InfinitePlanGrid } from "@/components/explore/InfinitePlanGrid";
import { Toaster } from "@/components/trip/Toaster";
import { plansByArea, regionsByArea, SHARED_PLANS, searchPlans, sortPlans } from "@/lib/explore";

export const metadata = { title: "모든 여행 계획 · tripplan" };

/** 다른 사람들이 공유한 모든 여행 계획 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; area?: string }>;
}) {
  const { sort, q, area } = await searchParams;
  const query = q?.trim() || undefined;
  const plans = sortPlans(searchPlans(plansByArea(SHARED_PLANS, area), query), sort);
  return (
    <Shell backHref="/" title="둘러보기">
      <div className="space-y-10">
        <header className="space-y-5 text-center">
          <div className="space-y-2">
            <h1 className="text-[1.75rem] font-bold tracking-tight sm:text-4xl">모든 여행 계획</h1>
            <p className="text-sm text-ink-500 sm:text-base">다른 사람들이 공유한 여행 계획 {SHARED_PLANS.length}개를 둘러보세요.</p>
          </div>
          <PlanSearch defaultValue={query} sort={sort} area={area} />
          <AreaTabs basePath="/explore" active={area} query={query} sort={sort} />
          <RegionButtons regions={regionsByArea(area)} />
        </header>
        {query && plans.length > 0 && (
          <p className="text-center text-sm text-ink-500">
            <b className="text-ink-900">&lsquo;{query}&rsquo;</b> 검색 결과
          </p>
        )}
        {/* 결과가 없으면 개수·정렬 대신 빈 화면만 */}
        {plans.length > 0 ? (
          <SortTabs basePath="/explore" active={sort} count={plans.length} query={query} area={area} />
        ) : (
          <EmptySearch query={query} />
        )}
        <InfinitePlanGrid plans={plans} />
      </div>
      <Toaster />
    </Shell>
  );
}
