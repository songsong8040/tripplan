"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/lib/store";
import type { Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

// 백엔드 PARTICIPANT_COLORS 와 동일한 순서. 인라인 스타일 대신 정적 클래스로 매핑한다.
const COLOR_CLASSES: Record<string, string> = {
  "#4f8262": "bg-mint-200 text-mint-700",
  "#bf6344": "bg-peach-200 text-peach-700",
  "#5b7bb5": "bg-sky-200 text-sky-700",
  "#b58a3c": "bg-butter-200 text-butter-700",
  "#8a5bb5": "bg-lilac-200 text-lilac-700",
  "#3c9aa0": "bg-mint-100 text-mint-700",
  "#b55b86": "bg-rose-200 text-rose-700",
  "#6b7280": "bg-ink-200 text-ink-700",
};

export function Avatar({
  person,
  size = "md",
  className,
}: {
  person: Pick<Participant, "nickname" | "color">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white",
        COLOR_CLASSES[person.color] ?? "bg-ink-200 text-ink-700",
        size === "sm" ? "h-6 w-6 text-[0.625rem]" : size === "lg" ? "h-12 w-12 text-sm" : "h-8 w-8 text-xs",
        className
      )}
    >
      {person.nickname.slice(0, 2)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Participant[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Tooltip key={p.id}>
          <TooltipTrigger asChild>
            <span>
              <Avatar person={p} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{p.nickname}</TooltipContent>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium ring-2 ring-background">
          +{rest}
        </span>
      )}
    </div>
  );
}

export function ShareButton({ compact = false, className, label = "초대 링크" }: { compact?: boolean; className?: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: "함께 여행 계획 짜요", url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우 복사로 대체
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("초대 링크를 복사했어요");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("링크를 복사하지 못했어요. 주소창의 링크를 공유해 주세요.");
    }
  };

  return (
    <Button variant="soft" size={compact ? "icon" : "sm"} onClick={share} aria-label="초대 링크 공유" className={className}>
      {copied ? <Check /> : compact ? <Share2 /> : <Link2 />}
      {!compact && (copied ? "복사됨" : label)}
    </Button>
  );
}
