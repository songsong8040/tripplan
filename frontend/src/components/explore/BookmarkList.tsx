"use client";

import * as React from "react";
import Link from "next/link";

import { SharedPlanCard } from "@/components/explore/cards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bookmark } from "@/components/ui/icons";
import { planById, type SharedPlan } from "@/lib/explore";
import { useBookmarkStore } from "@/lib/store";

/** 북마크한 공유 여행 계획 목록 (이 기기에 저장된 북마크 기준) */
export function BookmarkList() {
  const ids = useBookmarkStore((s) => s.ids);
  // localStorage 값은 hydration 이후에만 반영
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const plans = ids.map(planById).filter((p): p is SharedPlan => !!p);
  if (!plans.length)
    return (
      <EmptyState icon={Bookmark} title="북마크한 여행 계획이 없어요" description="마음에 드는 계획의 북마크 버튼을 눌러 모아 보세요.">
        <Button asChild>
          <Link href="/explore">계획 둘러보기</Link>
        </Button>
      </EmptyState>
    );

  return (
    <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => (
        <SharedPlanCard key={p.id} plan={p} />
      ))}
    </div>
  );
}
