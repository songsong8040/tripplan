import { cn } from "@/lib/utils";

/**
 * 로고 마크: 출발점(민트)에서 점선 경로를 따라 목적지 핀으로.
 * 블랙 & 화이트 + 파스텔 포인트 하나.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#111113" />
      {/* 경로 (점선) */}
      <path
        d="M11.5 28.5C15 21.5 22.5 27.5 26.6 21"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0 4.2"
      />
      {/* 출발점 */}
      <circle cx="11.3" cy="28.7" r="3.2" fill="#8fdbb8" />
      {/* 목적지 핀 */}
      <path d="M28 7.5a5.2 5.2 0 0 0-5.2 5.2c0 3.8 5.2 8.3 5.2 8.3s5.2-4.5 5.2-8.3A5.2 5.2 0 0 0 28 7.5z" fill="#fff" />
      <circle cx="28" cy="12.7" r="1.9" fill="#111113" />
    </svg>
  );
}

/** 마크 + 워드마크 */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showText && <span className="text-[1.0625rem] font-bold tracking-tight text-ink-900">tripplan</span>}
    </span>
  );
}
