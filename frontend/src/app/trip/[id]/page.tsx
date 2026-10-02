"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarRange,
  Loader2,
  LogOut,
  MapIcon,
  SlidersHorizontal,
  Users,
  Utensils,
} from "@/components/ui/icons";

import { BottomNav, PageTabs, Shell, type NavItem } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GeneratePanel, GeneratingCard } from "@/components/plan/GeneratePanel";
import { PlanBoard } from "@/components/plan/PlanBoard";
import { ActivityFeed } from "@/components/trip/ActivityFeed";
import { JoinDialog, PreferencesDialog } from "@/components/trip/JoinDialog";
import { Avatar, ShareButton } from "@/components/trip/people";
import { TripHero } from "@/components/trip/TripHero";
import { Toaster } from "@/components/trip/Toaster";
import { TripSpecForm } from "@/components/trip/TripSpecForm";
import { hasPrefs, joinedLabel, TripSteps } from "@/components/trip/TripSteps";
import { api, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { toast, useSessionStore, useTripStore } from "@/lib/store";
import type { TripSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

type TabKey = "plan" | "map" | "spec" | "people";

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const mounted = useMounted();
  const { trip, loading, error, notFound, load, sync, mutate } = useTripStore();
  const session = useSessionStore((s) => s.sessions[id]);
  const clearSession = useSessionStore((s) => s.clearSession);
  const [tab, setTab] = React.useState<TabKey>("plan");
  const [generating, setGenerating] = React.useState(false);
  const [prefsOpen, setPrefsOpen] = React.useState(false);

  React.useEffect(() => {
    void load(id);
  }, [id, load]);

  // 다른 참여자의 변경을 감지하는 버전 폴링 (탭이 보일 때만)
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [sync]);

  // 저장된 토큰이 여전히 유효한지 확인
  React.useEffect(() => {
    if (!session) return;
    api.me(id, session.token).catch((e: ApiError) => {
      if (e.status === 401 || e.status === 404) clearSession(id);
    });
  }, [id, session, clearSession]);

  // 탭을 바꾸면 맨 위로 (앱처럼)
  const changeTab = (next: string) => {
    setTab(next as TabKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!trip || trip.id !== id) {
    return (
      <Shell backHref="/">
        {notFound ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-sky-700">
              <MapIcon className="h-7 w-7" />
            </span>
            <p className="text-lg font-bold">여행 방을 찾을 수 없어요</p>
            <p className="text-sm text-muted-foreground">링크가 올바른지 확인해 주세요.</p>
            <Button asChild size="lg">
              <Link href="/">새 여행 만들기</Link>
            </Button>
          </div>
        ) : error && !loading ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
            <p className="whitespace-pre-line text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => load(id)}>다시 시도</Button>
          </div>
        ) : (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
          </div>
        )}
        <Toaster />
      </Shell>
    );
  }

  const me = session ? trip.participants.find((p) => p.id === session.participantId) : undefined;
  const joined = mounted && !!session;

  const saveSpec = async (spec: TripSpec) => {
    const first = !trip.spec;
    const ok = await mutate(
      (token) => api.updateSpec(id, token, spec),
      first ? "여행 조건을 저장했어요" : trip.plans.length ? "조건을 저장했어요. 필요하면 AI로 다시 만들어 보세요." : "조건을 저장했어요"
    );
    if (ok) changeTab("plan");
  };

  const generate = async () => {
    changeTab("plan");
    setGenerating(true);
    await mutate((token) => api.generate(id, token), "새 여행 계획이 도착했어요!");
    setGenerating(false);
  };

  const title = trip.spec?.title || (trip.spec ? `${trip.spec.region} 여행` : "새 여행");

  const baseNav: NavItem[] = [
    { key: "plan", label: "일정", icon: CalendarRange },
    { key: "spec", label: "조건", icon: SlidersHorizontal },
    {
      key: "people",
      label: "멤버",
      icon: Users,
      badge: (
        <span className="ml-0.5 rounded-full bg-ink-900/10 px-1.5 text-[0.625rem] leading-4 lg:bg-lilac-100 lg:px-2 lg:py-0.5 lg:text-lilac-700">
          {trip.participants.length}
        </span>
      ),
    },
  ];
  // 모바일·태블릿은 지도가 별도 탭, PC 는 일정 옆에 지도가 항상 보인다
  const mobileNav: NavItem[] = [baseNav[0], { key: "map", label: "지도", icon: MapIcon }, baseNav[1], { ...baseNav[2], badge: undefined }];
  const desktopTab = tab === "map" ? "plan" : tab;

  const planArea =
    generating ? (
      <GeneratingCard />
    ) : trip.plans.length ? (
      <PlanBoard trip={trip} onRegenerate={generate} mobileView={tab === "map" ? "map" : "list"} onShowList={() => changeTab("plan")} />
    ) : (
      <GeneratePanel trip={trip} onGenerate={generate} onEditSpec={() => changeTab("spec")} />
    );

  return (
    <Shell
      backHref="/my"
      title={title}
      hideLogin
      bottomNav={trip.spec ? <BottomNav items={mobileNav} active={tab} onChange={changeTab} /> : undefined}
      actions={
        <>
          {me && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="내 메뉴" className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                  <Avatar person={me} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{me.nickname}님으로 참여 중</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setPrefsOpen(true)}>
                  <Utensils /> 음식 취향 수정
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    clearSession(id);
                    toast("이 기기에서 나왔어요. 같은 닉네임과 PIN으로 다시 들어올 수 있어요.");
                  }}
                >
                  <LogOut /> 이 기기에서 나가기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      }
    >
      {!trip.spec ? (
        <div className="space-y-7">
          <div className="animate-fade-up space-y-2">
            <TripSteps trip={trip} onGo={() => undefined} className="pb-3" />
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">어떤 여행을 계획하고 있나요?</h1>
            <p className="text-muted-foreground">조건을 저장한 뒤 초대 링크로 친구들을 불러 취향을 모아보세요.</p>
          </div>
          <TripSpecForm onSubmit={saveSpec} submitLabel="조건 저장하고 계속" />
        </div>
      ) : (
        <div className="space-y-6 lg:space-y-8">
          {/* 지도 탭(모바일)에서는 지도를 크게 보이도록 위쪽을 숨긴다 */}
          <div className={cn("space-y-4 lg:space-y-5", tab === "map" && "hidden lg:block")}>
            <TripHero trip={trip} spec={trip.spec} title={title} />
            <TripSteps trip={trip} onGo={changeTab} />
          </div>
          {/* PC: 크게 보이는 탭 (스크롤해도 헤더 아래에 붙음). 모바일·태블릿은 하단 탭바 */}
          <div className="sticky top-16 z-30 -mx-10 hidden border-b border-ink-100 bg-white/90 px-10 backdrop-blur-xl lg:block 2xl:-mx-14 2xl:px-14">
            <PageTabs items={baseNav} active={desktopTab} onChange={changeTab} />
          </div>

          {(tab === "plan" || tab === "map") && planArea}

          {tab === "spec" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">여행 조건</h2>
              <TripSpecForm key={JSON.stringify(trip.spec)} initial={trip.spec} onSubmit={saveSpec} submitLabel="조건 저장" />
            </div>
          )}

          {tab === "people" && (
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-10">
              <section className="space-y-4">
                {/* 초대 카드 */}
                <div className="flex flex-col gap-4 rounded-[1.75rem] bg-ink-50 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-lg font-bold tracking-tight">친구 초대</p>
                    <p className="text-sm text-ink-600">
                      링크를 보내면 바로 함께할 수 있어요 · <b className="text-ink-900">{joinedLabel(trip)}</b>
                    </p>
                  </div>
                  <ShareButton label="초대 링크 복사" className="h-11 shrink-0 rounded-full bg-ink-900 px-5 text-white ring-0 hover:bg-ink-800" />
                </div>

                <div className="flex items-end justify-between px-1 pt-2">
                  <h2 className="text-lg font-bold tracking-tight">참여자 {trip.participants.length}</h2>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {trip.participants.map((p) => {
                    const isMe = p.id === me?.id;
                    const prefs = [
                      ...p.allergies.map((a) => ({ key: `a-${a}`, label: `알레르기 · ${a}`, tone: "bg-rose-50 text-rose-600" })),
                      ...p.dislikes.map((d) => ({ key: `d-${d}`, label: `기피 · ${d}`, tone: "bg-ink-100 text-ink-600" })),
                      ...p.preferred_tags.map((t) => ({ key: `t-${t}`, label: t, tone: "bg-mint-50 text-mint-700" })),
                      ...(p.drinking
                        ? [
                            {
                              key: "drink",
                              label: `음주 · ${p.drinking}${p.drink_types?.length ? ` (${p.drink_types.join("·")})` : ""}`,
                              tone: "bg-lilac-50 text-lilac-700",
                            },
                          ]
                        : []),
                    ];
                    return (
                      <li
                        key={p.id}
                        className={cn("rounded-[1.5rem] bg-white p-4 shadow-soft ring-1 ring-inset", isMe ? "ring-ink-900/15" : "ring-ink-100")}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar person={p} size="lg" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 font-bold">
                              <span className="truncate">{p.nickname}</span>
                              {isMe && <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">나</span>}
                            </p>
                            <p className="flex items-center gap-1.5 text-xs text-ink-400">
                              {timeAgo(p.joined_at)} 참여
                              <span
                                className={cn(
                                  "rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold",
                                  hasPrefs(p) ? "bg-mint-50 text-mint-700" : "bg-butter-50 text-butter-700"
                                )}
                              >
                                {hasPrefs(p) ? "취향 입력 완료" : "취향 입력 전"}
                              </span>
                            </p>
                          </div>
                          {isMe && (
                            <Button
                              variant={hasPrefs(p) ? "secondary" : "default"}
                              size="sm"
                              className="rounded-full"
                              onClick={() => setPrefsOpen(true)}
                            >
                              {hasPrefs(p) ? "취향 수정" : "취향 입력"}
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {prefs.length ? (
                            prefs.map((x) => (
                              <span key={x.key} className={cn("rounded-md px-2 py-1 text-xs font-medium", x.tone)}>
                                {x.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-ink-400">{isMe ? "알레르기·못 먹는 음식·좋아하는 것을 남기면 일정에 반영돼요" : hasPrefs(p) ? "특별히 가리는 건 없어요" : "아직 취향을 입력하지 않았어요"}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="px-1 text-lg font-bold tracking-tight">활동 기록</h2>
                <div className="rounded-[1.75rem] bg-ink-50 p-5 sm:p-6">
                  <ActivityFeed activity={trip.activity} participants={trip.participants} />
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      <JoinDialog tripId={id} open={mounted && !joined} />
      {me && <PreferencesDialog me={me} open={prefsOpen} onOpenChange={setPrefsOpen} />}
      <Toaster />
    </Shell>
  );
}
