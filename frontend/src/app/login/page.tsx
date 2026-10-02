"use client";

import Link from "next/link";

import { Shell } from "@/components/layout/Shell";
import { LogoMark } from "@/components/layout/Logo";
import { Toaster } from "@/components/trip/Toaster";
import { ArrowRight } from "@/components/ui/icons";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { key: "kakao", label: "카카오로 시작하기", className: "bg-[#FEE500] text-[#191919]", mark: "K", markClass: "bg-[#191919] text-[#FEE500]" },
  { key: "naver", label: "네이버로 시작하기", className: "bg-[#03C75A] text-white", mark: "N", markClass: "bg-white text-[#03C75A]" },
  { key: "google", label: "Google로 시작하기", className: "bg-white text-ink-900 ring-1 ring-inset ring-ink-200", mark: "G", markClass: "bg-[#1A73E8] text-white" },
];

/** 로그인 (목업) — 계정 연동은 준비 중, 지금은 로그인 없이 링크로 사용 */
export default function LoginPage() {
  return (
    <Shell backHref="/" title="로그인">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-8 pt-6 text-center sm:pt-12">
        <div className="space-y-4">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">tripplan 시작하기</h1>
          <p className="text-sm text-ink-500">로그인하면 여러 기기에서 내 여행을 한 번에 모아볼 수 있어요.</p>
        </div>

        <div className="w-full space-y-2.5">
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toast("계정 연동은 준비 중이에요. 지금은 로그인 없이 링크로 사용할 수 있어요.")}
              className={cn("flex h-14 w-full items-center gap-3 rounded-full px-5 text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98]", p.className)}
            >
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-black", p.markClass)}>{p.mark}</span>
              <span className="flex-1 text-center">{p.label}</span>
              <span className="w-7" />
            </button>
          ))}
        </div>

        <div className="w-full rounded-3xl bg-lilac-50 p-5 ring-1 ring-inset ring-lilac-100">
          <p className="text-sm font-bold text-lilac-700">로그인 없이도 괜찮아요</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            여행을 만들고 링크를 공유하면, 친구들은 닉네임과 6자리 PIN만으로 참여할 수 있어요.
          </p>
          <Link href="/my" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-lilac-700 hover:underline">
            이 기기의 내 여행 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <Toaster />
    </Shell>
  );
}
