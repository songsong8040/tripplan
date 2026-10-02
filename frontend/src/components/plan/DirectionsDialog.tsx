"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, ExternalLink, Navigation } from "@/components/ui/icons";
import { directionsOptions, inKorea, type DirectionsOption, type Point } from "@/lib/directions";
import { MODE_LABEL, type Mode } from "@/lib/route";
import { cn } from "@/lib/utils";

/** 서비스별 상징 색 + 로고 글자 */
const BRAND: Record<DirectionsOption["key"], { tile: string; mark: string; markText: string }> = {
  kakao: { tile: "bg-[#FEE500] text-[#191919]", mark: "bg-[#191919] text-[#FEE500]", markText: "K" },
  naver: { tile: "bg-[#03C75A] text-white", mark: "bg-white text-[#03C75A]", markText: "N" },
  tmap: { tile: "bg-[#0064FF] text-white", mark: "bg-white text-[#0064FF]", markText: "T" },
  google: { tile: "bg-white text-ink-900 ring-1 ring-inset ring-ink-200", mark: "bg-[#1A73E8] text-white", markText: "G" },
};

export interface DirectionsTarget {
  from: Point;
  to: Point;
  mode: Mode;
}

/** 길찾기 앱 선택 모달 (해외 구간은 구글 지도만) */
export function DirectionsDialog({ target, onOpenChange }: { target: DirectionsTarget | null; onOpenChange: (open: boolean) => void }) {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)), []);
  if (!target) return null;

  const options = directionsOptions(target.from, target.to, target.mode, mobile);
  const overseas = !inKorea(target.from) || !inKorea(target.to);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Navigation className="h-3.5 w-3.5" />
            </span>
            길찾기
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 pt-1">
            <span className="truncate font-semibold text-ink-700">{target.from.name}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate font-semibold text-ink-700">{target.to.name}</span>
            <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[0.6875rem] font-semibold">{MODE_LABEL[target.mode]}</span>
          </DialogDescription>
        </DialogHeader>

        <div className={cn("grid gap-2", options.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {options.map((o) => {
            const b = BRAND[o.key];
            const disabled = o.appOnly && !mobile;
            return (
              <a
                key={o.key}
                href={disabled ? undefined : o.url}
                target={o.url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                aria-disabled={disabled}
                onClick={() => !disabled && onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-3xl p-4 font-bold transition-all",
                  b.tile,
                  disabled ? "cursor-not-allowed opacity-40" : "hover:-translate-y-0.5 hover:shadow-lift"
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black", b.mark)}>{b.markText}</span>
                <span className="min-w-0 flex-1">
                  <span className="block">{o.label}</span>
                  <span className="block text-[0.6875rem] font-medium opacity-70">
                    {disabled ? "휴대폰 앱에서만 열려요" : o.appOnly || o.url.startsWith("nmap") ? "앱으로 열기" : "웹에서 열기"}
                  </span>
                </span>
                {!disabled && <ExternalLink className="h-3 w-3 opacity-60" />}
              </a>
            );
          })}
        </div>

        <p className="rounded-2xl bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-500">
          {overseas
            ? "해외 구간이라 구글 지도만 지원해요. 카카오맵·네이버지도·티맵 길찾기는 국내 경로만 안내해요."
            : "티맵은 휴대폰에 앱이 설치돼 있어야 열려요. 대중교통 경로는 카카오맵·네이버지도가 가장 정확해요."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
