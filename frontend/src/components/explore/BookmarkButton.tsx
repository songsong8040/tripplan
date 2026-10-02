"use client";

import * as React from "react";

import { Bookmark, BookmarkFilled } from "@/components/ui/icons";
import { toast, useBookmarkStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** 공유 여행 계획 북마크 토글. 카드(Link) 안에 있어도 이동하지 않도록 클릭을 막는다 */
export function BookmarkButton({ planId, className, variant = "overlay" }: { planId: string; className?: string; variant?: "overlay" | "plain" }) {
  const ids = useBookmarkStore((s) => s.ids);
  const toggle = useBookmarkStore((s) => s.toggle);
  // localStorage 값은 hydration 이후에만 반영
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const on = mounted && ids.includes(planId);

  return (
    <button
      type="button"
      aria-label={on ? "북마크 해제" : "북마크"}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toast(toggle(planId) ? "북마크했어요 · 내 여행 > 북마크에서 볼 수 있어요" : "북마크를 해제했어요");
      }}
      className={cn(
        "flex items-center justify-center rounded-full transition-all active:scale-90",
        variant === "overlay"
          ? "h-9 w-9 bg-black/35 text-white backdrop-blur hover:bg-black/50"
          : "h-10 w-10 bg-ink-100 text-ink-700 hover:bg-ink-200",
        on && variant === "overlay" && "bg-white text-ink-900 hover:bg-white",
        on && variant === "plain" && "bg-ink-900 text-white hover:bg-ink-800",
        className
      )}
    >
      {on ? <BookmarkFilled className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
    </button>
  );
}
