"use client";

import * as React from "react";

import { SharedPlanCard } from "@/components/explore/cards";
import type { SharedPlan } from "@/lib/explore";

const PAGE = 12;

/**
 * 무한 스크롤 목록: 처음 12개, 바닥 근처에 닿으면 로딩 후 12개씩 더.
 * (목데이터라 서버 호출 대신 잠깐의 지연으로 불러오는 느낌만 준다)
 */
export function InfinitePlanGrid({ plans }: { plans: SharedPlan[] }) {
  const [count, setCount] = React.useState(PAGE);
  const [loading, setLoading] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const hasMore = count < plans.length;

  // 정렬·검색·지역이 바뀌면 처음부터
  React.useEffect(() => {
    setCount(PAGE);
    setLoading(false);
  }, [plans]);

  // 바닥이 보이면 로딩 시작 (loading 을 의존성에 넣으면 타이머가 정리돼 영원히 돌던 문제가 있었다)
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setLoading(true), { rootMargin: "320px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, count]);

  // 로딩이 시작되면 잠깐 뒤 12개 더
  React.useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setCount((c) => Math.min(c + PAGE, plans.length));
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [loading, plans.length]);

  return (
    <div className="space-y-10">
      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {plans.slice(0, count).map((p) => (
          <SharedPlanCard key={p.id} plan={p} />
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinel} className="flex h-16 items-center justify-center gap-2 text-sm text-ink-400">
          {loading && (
            <span role="status" aria-label="더 불러오는 중" className="flex h-6 items-end gap-1.5">
              {/* 회색 점들이 차례로 튀어 오르며 그 순간만 검은색 */}
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="dot-bounce h-2.5 w-2.5 rounded-full bg-ink-300" />
              ))}
            </span>
          )}
        </div>
      ) : (
        plans.length > PAGE && <p className="pb-4 text-center text-sm text-ink-400">모든 계획을 다 봤어요</p>
      )}
    </div>
  );
}
