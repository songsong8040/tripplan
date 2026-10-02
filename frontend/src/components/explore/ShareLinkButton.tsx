"use client";

import { Share2 } from "@/components/ui/icons";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";

/** 현재 페이지 링크 복사 (모바일은 공유 시트) */
export function ShareLinkButton({ className, title }: { className?: string; title: string }) {
  return (
    <button
      type="button"
      aria-label="링크 공유"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            // 공유 시트를 닫으면 복사로 대체
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          toast("링크를 복사했어요");
        } catch {
          toast("링크를 복사하지 못했어요");
        }
      }}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-all hover:bg-black/50 active:scale-90",
        className
      )}
    >
      <Share2 className="h-3.5 w-3.5" />
    </button>
  );
}
