import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { BookmarkButton } from "@/components/explore/BookmarkButton";
import {
  Bus,
  Car,
  Footprints,
  Heart,
  MapPin,
  Plus,
  CalendarCheck,
  Search,
  X,
} from "@/components/ui/icons";
import { SortSelect } from "@/components/explore/SortSelect";
import {
  AREAS,
  monthSeason,
  periodLabel,
  REGIONS,
  regionByKey,
  regionLabel,
  planMembers,
  regionPillTone,
  tagSearchHref,
  type Region,
  type SharedPlan,
} from "@/lib/explore";
import { cn } from "@/lib/utils";

const TRANSPORT_ICON = {
  자차: Car,
  대중교통: Bus,
  "도보 위주": Footprints,
} as const;

/** 여행 시기 · 기간 · 이동수단을 작은 태그로 */
export function PlanMetaTags({
  plan,
  variant = "light",
  className,
}: {
  plan: SharedPlan;
  variant?: "light" | "overlay";
  className?: string;
}) {
  const Transport = TRANSPORT_ICON[plan.transport];
  const tag = cn(
    "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium leading-none",
    variant === "light"
      ? "bg-ink-100 text-ink-600"
      : "bg-white/20 text-white backdrop-blur",
  );
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      <span className={tag}>{monthSeason(plan.travelMonth)}</span>
      <span className={tag}>{periodLabel(plan)}</span>
      <span className={tag}>
        <Transport className="block h-3 w-3" />
        {plan.transport === "도보 위주" ? "도보" : plan.transport}
      </span>
    </div>
  );
}

/**
 * 여행지 고르기: 동그란 사진 + 이름 (앱 스토리 느낌).
 * 국내·해외가 섞여 있으면 사이에 얇은 구분선. 다 들어가면 가운데, 넘치면 옆으로 스와이프.
 */
export function RegionButtons({
  regions,
  active,
  grouped = true,
  moreHref,
}: {
  regions: Region[];
  active?: string;
  /** 국내·해외를 나눠 사이에 구분선 */
  grouped?: boolean;
  /** 맨 끝에 '전체 보기' 버튼 */
  moreHref?: string;
}) {
  const groups = grouped
    ? [
        regions.filter((r) => !r.overseas),
        regions.filter((r) => r.overseas),
      ].filter((g) => g.length)
    : [regions];
  return (
    <div className="-mx-4 -my-4 overflow-x-auto px-4 py-5 [scrollbar-width:none] sm:-mx-4 sm:px-4 [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-max items-start gap-2 sm:gap-2.5">
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <span
                aria-hidden
                className="mx-1 mt-4 h-10 w-px shrink-0 bg-ink-200"
              />
            )}
            {group.map((r) => {
              const on = active === r.key;
              return (
                <Link
                  key={r.key}
                  href={`/explore/${r.key}`}
                  // 배경은 그대로, 선택·호버 때 국내/해외 색 그라데이션 테두리 + 바깥 빛 (globals.css .region-pill)
                  data-area={r.overseas ? "overseas" : "domestic"}
                  data-active={on || undefined}
                  className="region-pill group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-full px-1 pb-3.5 pt-1"
                >
                  <span className="p-[2.5px]">
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full border-[3px] border-white bg-ink-100 shadow-[0_2px_8px_rgba(25,31,40,0.08)]">
                      <Image
                        src={r.image}
                        alt=""
                        fill
                        sizes="120px"
                        quality={90}
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "max-w-full truncate text-[0.8125rem] leading-tight",
                      on
                        ? "font-bold text-ink-900"
                        : "font-semibold text-ink-700",
                    )}
                  >
                    {r.name}
                  </span>
                  <span
                    className={cn(
                      "-mt-1 inline-flex items-center gap-0.5 text-[0.6875rem] leading-tight",
                      on
                        ? "font-semibold text-ink-700"
                        : "text-ink-400 group-hover:text-ink-600",
                    )}
                  >
                    <CalendarCheck className="h-2 w-2" />
                    {r.planCount}개
                  </span>
                </Link>
              );
            })}
          </React.Fragment>
        ))}
        {moreHref && (
          <Link
            href={moreHref}
            className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-full bg-ink-50 px-1 pb-3.5 pt-1 transition-colors hover:bg-ink-100"
          >
            <span className="p-[2.5px]">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink-700 shadow-soft transition-transform duration-300 group-hover:scale-105">
                <Plus className="h-4 w-4" />
              </span>
            </span>
            <span className="text-[0.8125rem] font-semibold leading-tight text-ink-700">
              전체 보기
            </span>
            <span className="-mt-1 inline-flex items-center gap-0.5 text-[0.6875rem] leading-tight text-ink-400">
              <MapPin className="h-2 w-2" />
              {REGIONS.length}곳
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

const AVATAR_TONES = [
  "bg-mint-100 text-mint-700",
  "bg-sky-100 text-sky-700",
  "bg-lilac-100 text-lilac-700",
  "bg-peach-100 text-peach-700",
  "bg-butter-100 text-butter-700",
];

/**
 * 인스타 스토리 같은 작성자 표시: 흰 테두리 프로필 + 이름.
 * 여럿이 함께 계획했으면 프로필을 최대 3개까지 겹치고 "민지 외 2명".
 */
export function AuthorStory({
  names,
  className,
}: {
  names: string[];
  className?: string;
}) {
  const shown = names.slice(0, 3);
  const rest = names.length - 1;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="flex shrink-0 -space-x-2.5">
        {shown.map((name, i) => (
          <span
            key={name}
            // 모두 같은 크기·같은 흰 테두리. 왼쪽이 맨 위로 오도록 차례로 겹침
            className={cn(
              "relative rounded-full bg-white p-[2px]",
              ["z-30", "z-20", "z-10"][i],
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[0.6875rem] font-bold",
                AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length],
              )}
            >
              {name.slice(0, 1)}
            </span>
          </span>
        ))}
      </span>
      <span className="truncate text-[0.8125rem] font-semibold drop-shadow">
        {names[0]}
        {rest > 0 && (
          <span className="font-medium opacity-80"> 외 {rest}명</span>
        )}
      </span>
    </span>
  );
}

/** 공유된 여행 계획 카드 (목록용): 사진 위, 글은 사진 아래 왼쪽 정렬 */
export function SharedPlanCard({ plan }: { plan: SharedPlan }) {
  const region = regionByKey(plan.regionKey);
  return (
    <div className="group text-left">
      <Link href={`/explore/plan/${plan.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-ink-100">
          {region && (
            <Image
              src={region.image}
              alt={`${region.name} 대표 이미지`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-soft",
              regionPillTone(region),
            )}
          >
            {region ? regionLabel(region) : ""}
          </span>
          <BookmarkButton planId={plan.id} className="absolute right-3 top-3" />
          {/* 인스타 스토리처럼: 사진 아래쪽에 작성자 프로필 + 좋아요 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-white">
            <AuthorStory names={planMembers(plan)} />
            <span className="inline-flex items-center gap-1 text-xs font-semibold leading-none drop-shadow">
              <Heart className="block h-2.5 w-2.5 translate-y-[0.5px]" />
              {plan.likes}
            </span>
          </div>
        </div>
        <div className="space-y-1 px-1 pt-3">
          <PlanMetaTags plan={plan} className="pb-1" />
          <h3 className="text-xl font-bold leading-snug tracking-tight">
            {plan.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-700">
            {plan.summary}
          </p>
        </div>
      </Link>
      {/* 해시태그를 누르면 같은 태그의 계획 검색 */}
      <div className="mt-2 flex min-w-0 gap-2.5 overflow-hidden whitespace-nowrap px-1 text-xs font-medium text-[#3182f6]">
        {plan.tags.map((t) => (
          <Link
            key={t}
            href={tagSearchHref(t)}
            className="shrink-0 hover:underline"
          >
            #{t}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** 결과 개수 + 정렬 셀렉트 (주소의 ?sort= 로 유지) */
export function SortTabs({
  basePath,
  active,
  count,
  query,
  area,
}: {
  basePath: string;
  active?: string;
  count: number;
  query?: string;
  area?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-ink-700">
        계획 <span className="text-ink-900">{count}</span>개
      </p>
      <SortSelect
        basePath={basePath}
        active={active}
        query={query}
        area={area}
      />
    </div>
  );
}

/** 여행 계획 검색창 (GET 폼이라 JS 없이도 동작, 결과는 둘러보기 페이지) */
export function PlanSearch({
  defaultValue,
  sort,
  action = "/explore",
  className,
  size = "default",
  area,
}: {
  defaultValue?: string;
  sort?: string;
  area?: string;
  action?: string;
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <form
      action={action}
      role="search"
      className={cn("mx-auto w-full max-w-xl", className)}
    >
      {/* 아이콘 기준은 입력창만 감싼 상자 (폼 여백·인라인 줄높이 때문에 위로 뜨지 않게) */}
      <div className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 block -translate-y-1/2 text-ink-400",
            size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5",
          )}
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="여행지, 장소, 테마로 검색 (예: 제주 카페, 스타필드)"
          className={cn(
            "block w-full rounded-2xl border border-transparent bg-ink-100 pl-11 pr-11 text-[0.9375rem] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-ink-900 focus:bg-white [&::-webkit-search-cancel-button]:hidden",
            size === "lg" ? "h-14" : "h-12",
          )}
        />
        {sort && sort !== "popular" && (
          <input type="hidden" name="sort" value={sort} />
        )}
        {area && area !== "all" && (
          <input type="hidden" name="area" value={area} />
        )}
        {defaultValue && (
          <Link
            href={
              sort && sort !== "popular" ? `${action}?sort=${sort}` : action
            }
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-ink-300 text-white hover:bg-ink-400"
          >
            <X className="h-3 w-3" />
          </Link>
        )}
      </div>
    </form>
  );
}

/** 선택된 탭 색: 국내는 코랄, 해외는 블루·퍼플 그라데이션 */
const AREA_ACTIVE: Record<string, string> = {
  domestic:
    "bg-gradient-to-r from-peach-400 to-rose-400 text-white shadow-soft",
  overseas: "bg-gradient-to-r from-sky-400 to-lilac-500 text-white shadow-soft",
};

/** 전체 / 국내 / 해외 탭 (주소의 ?area= 로 유지) */
export function AreaTabs({
  basePath,
  active,
  query,
  sort,
}: {
  basePath: string;
  active?: string;
  query?: string;
  sort?: string;
}) {
  const current = AREAS.some((a) => a.key === active) ? active : "all";
  return (
    <div className="mx-auto flex w-max gap-1 rounded-full bg-ink-100 p-1">
      {AREAS.map((a) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (a.key !== "all") params.set("area", a.key);
        if (sort && sort !== "popular") params.set("sort", sort);
        const qs = params.toString();
        return (
          <Link
            key={a.key}
            href={qs ? `${basePath}?${qs}` : basePath}
            scroll={false}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-5 text-sm font-semibold transition-all",
              current === a.key
                ? (AREA_ACTIVE[a.key] ?? "bg-ink-900 text-white shadow-soft")
                : "text-ink-500 hover:text-ink-900",
            )}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
