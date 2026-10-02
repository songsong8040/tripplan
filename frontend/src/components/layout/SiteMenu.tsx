"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookmarkFilled, Compass, Home, LogIn, MapIcon, Menu } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/explore", label: "둘러보기", icon: Compass, tone: "bg-lilac-100 text-lilac-700" },
  // 여행 방(/trip/...)도 내 여행에 속한다
  { href: "/my", label: "내 여행", icon: MapIcon, tone: "bg-sky-100 text-sky-700", also: ["/trip"] },
  { href: "/bookmarks", label: "북마크", icon: BookmarkFilled, tone: "bg-butter-100 text-butter-700" },
];

function isActive(pathname: string, href: string) {
  const link = LINKS.find((l) => l.href === href);
  const also = link && "also" in link ? (link.also ?? []) : [];
  return [href, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** PC 헤더 가운데 메뉴 (둘러보기 · 내 여행 · 북마크) */
export function SiteLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 rounded-full bg-ink-100 p-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all",
              active ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-900"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/** PC 헤더 오른쪽 로그인 버튼 */
export function LoginLink({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-700",
        className
      )}
    >
      <LogIn className="h-3.5 w-3.5" />
      로그인
    </Link>
  );
}

/** 전체 메뉴 (☰) — 모바일과 탭이 있는 화면에서 사용 */
export function SiteMenu({ className }: { className?: string }) {
  const items = [{ href: "/", label: "홈", icon: Home, tone: "bg-ink-100 text-ink-700" }, ...LINKS];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="메뉴"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50",
            className
          )}
        >
          <Menu className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map(({ href, label, icon: Icon, tone }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-white">
              <LogIn className="h-3.5 w-3.5" />
            </span>
            로그인
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
