import Link from "next/link";

import { CalendarCheck, RefreshCw } from "@/components/ui/icons";
import { tagSearchHref } from "@/lib/explore";

const SUGGEST_TAGS = ["카페 투어", "맛집 투어", "힐링", "야경/나이트라이프", "자연 경관"];

/** 검색 결과 없음: 남는 높이를 채우고, 다른 검색어를 바로 눌러볼 수 있게 */
export function EmptySearch({ query }: { query?: string }) {
  return (
    <div className="flex min-h-[max(22rem,calc(100dvh-36rem))] flex-col items-center justify-center gap-6 rounded-[2rem] bg-ink-50 px-6 py-14 text-center">
      <div className="relative">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-soft">
          <CalendarCheck className="h-6 w-6 text-ink-700" />
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-bold tracking-tight">
          {query ? (
            <>
              &lsquo;{query}&rsquo;에 맞는 계획이 없어요
            </>
          ) : (
            "검색 결과가 없어요"
          )}
        </p>
        <p className="text-sm text-ink-500">다른 여행지나 장소 이름으로 검색해 보세요.</p>
      </div>
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-ink-400">이런 태그는 어때요?</p>
        <div className="flex max-w-md flex-wrap justify-center gap-1.5 lg:max-w-none lg:flex-nowrap">
          {SUGGEST_TAGS.map((t) => (
            <Link
              key={t}
              href={tagSearchHref(t)}
              className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-white px-3.5 text-[0.8125rem] font-medium text-[#3182f6] shadow-soft transition-transform hover:-translate-y-0.5"
            >
              #{t}
            </Link>
          ))}
        </div>
      </div>
      <Link
        href="/explore"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
      >
        <RefreshCw className="h-3 w-3" />
        전체 계획 보기
      </Link>
    </div>
  );
}
