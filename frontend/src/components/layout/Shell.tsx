import Link from "next/link";

import { Logo, LogoMark } from "@/components/layout/Logo";
import { LoginLink, SiteLinks, SiteMenu } from "@/components/layout/SiteMenu";
import { ArrowLeft, type LucideIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** 모든 페이지가 공유하는 컨테이너 (헤더와 본문이 같은 여백을 써야 로고 위치가 흔들리지 않는다) */
const CONTAINER = "w-full px-4 sm:px-6 lg:px-10 2xl:px-14";

interface ShellProps {
  children: React.ReactNode;
  /** 헤더 우측 액션 영역 */
  actions?: React.ReactNode;
  /** 헤더 타이틀 */
  title?: React.ReactNode;
  /** 모바일에서 로고 대신 뒤로가기 버튼을 보여줄 경로 */
  backHref?: string;
  /** PC 헤더 중앙의 내비게이션 */
  nav?: React.ReactNode;
  /** 모바일·태블릿 하단 탭바 */
  bottomNav?: React.ReactNode;
  className?: string;
  /** 헤더의 로그인 버튼 숨김 (여행 방처럼 이미 참여 중인 화면) */
  hideLogin?: boolean;
}

/**
 * 반응형 레이아웃 셸
 * - 모바일·태블릿(< lg): 앱처럼 간결한 상단 바 + 하단 탭바
 * - PC(≥ lg): 로고·내비게이션·액션이 있는 웹 헤더, 전체 폭 본문
 */
export function Shell({ children, actions, title, backHref, nav, bottomNav, className, hideLogin }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className={cn(CONTAINER, "relative flex h-14 items-center gap-3 lg:h-16")}>
          {backHref ? (
            <>
              <Link
                href={backHref}
                aria-label="뒤로"
                className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink-100 lg:hidden"
              >
                <ArrowLeft className="h-[18px] w-[18px]" />
              </Link>
              <Link href="/" className="hidden shrink-0 lg:block">
                <Logo />
              </Link>
            </>
          ) : (
            <Link href="/" className="shrink-0">
              <LogoMark className="sm:hidden" />
              <Logo className="hidden sm:inline-flex" />
            </Link>
          )}

          {title && (
            // PC 에서는 가운데 메뉴와 겹치지 않도록 왼쪽 영역 폭을 제한
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-[calc(50%-20rem)]">
              <span className="hidden h-5 w-px bg-ink-200 lg:block" />
              <div className="min-w-0 truncate text-[0.9375rem] font-semibold lg:text-sm lg:font-medium lg:text-ink-500">
                {title}
              </div>
            </div>
          )}

          {/* PC: 메뉴는 어느 페이지든 헤더 정가운데에 고정 */}
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex">{nav ?? <SiteLinks />}</nav>

          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            {/* 여행 화면은 가운데가 탭이라 사이트 메뉴는 ☰ 로, 그 외 PC 는 로그인 버튼 */}
            {!nav && !hideLogin && <LoginLink className="hidden lg:inline-flex" />}
            <SiteMenu className={nav ? "" : "lg:hidden"} />
          </div>
        </div>
      </header>

      <main
        className={cn(
          CONTAINER,
          "flex-1 pt-5 sm:pt-8 lg:pt-10",
          bottomNav
            ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)] lg:pb-16"
            : "pb-[calc(env(safe-area-inset-bottom)+3rem)]",
          className
        )}
      >
        {children}
      </main>

      {bottomNav}
    </div>
  );
}

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
}

/** 모바일·태블릿 하단 탭바 (앱 스타일) */
export function BottomNav({
  items,
  active,
  onChange,
}: {
  items: NavItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        {items.map(({ key, label, icon: Icon, badge }) => {
          const on = key === active;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={on ? "page" : undefined}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold"
              >
                <span
                  className={cn(
                    "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    on ? "bg-ink-900 text-white" : "text-ink-400"
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" />
                  {badge}
                </span>
                <span className={on ? "text-ink-900" : "text-ink-400"}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** PC 헤더용 내비게이션 (알약형 세그먼트) */
export function TopNav({
  items,
  active,
  onChange,
  className,
}: {
  items: NavItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex w-max items-center gap-1 rounded-full bg-ink-100 p-1", className)}>
      {items.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all",
            key === active ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-900"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {badge}
        </button>
      ))}
    </div>
  );
}

/** 본문 안의 밑줄 탭 (PC 에서 페이지 제목 아래) */
export function PageTabs({
  items,
  active,
  onChange,
  className,
}: {
  items: NavItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-8", className)}>
      {items.map(({ key, label, icon: Icon, badge }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-14 items-center gap-2 border-b-[3px] text-base font-bold transition-colors",
              on ? "border-ink-900 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge}
          </button>
        );
      })}
    </div>
  );
}

/** 섹션 제목 + 설명 + 본문을 일정한 간격으로 배치 */
export function Section({
  title,
  description,
  children,
  className,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
