"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { AuthorStory } from "@/components/explore/cards";
import { Toaster } from "@/components/trip/Toaster";
import { currentStepLabel, stepsOf } from "@/components/trip/TripSteps";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bus, CalendarCheck, Car, Check, Footprints, Loader2, MapIcon, Plus, Users } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api";
import { REGIONS, regionPillTone } from "@/lib/explore";
import { timeAgo, tripDDay } from "@/lib/format";
import { toast, useSessionStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRANSPORT_ICON = { 자차: Car, 대중교통: Bus, "도보 위주": Footprints } as const;
const FALLBACK_TONES = [
  "from-lilac-100 to-sky-100 text-lilac-700",
  "from-mint-100 to-sky-100 text-mint-700",
  "from-peach-100 to-butter-100 text-peach-700",
  "from-sky-100 to-mint-100 text-sky-700",
  "from-butter-100 to-peach-100 text-butter-700",
];

/** 이 기기에서 참여한 여행 목록 (세션 기준으로 서버에서 불러옴) */
function useMyTrips() {
  const sessions = useSessionStore((s) => s.sessions);
  const ids = React.useMemo(() => Object.keys(sessions).reverse(), [sessions]);
  const [trips, setTrips] = React.useState<Trip[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map((id) => api.getTrip(id).catch(() => null))).then((r) => {
      if (cancelled) return;
      setTrips(r.filter((t): t is Trip => t !== null).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return { trips, sessions };
}

const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;

/** 내 여행 카드: 사진(또는 파스텔) 위에 진행 단계, 아래에 일정·멤버 */
function MyTripCard({ trip, index, nickname }: { trip: Trip; index: number; nickname?: string }) {
  const spec = trip.spec;
  const title = spec?.title || (spec ? `${spec.region} 여행` : "조건 입력 전 여행");
  const region = spec ? REGIONS.find((r) => spec.region.includes(r.name)) : undefined;
  const steps = stepsOf(trip);
  const step = currentStepLabel(trip);
  const badge = tripDDay(spec);
  const Transport = spec && spec.transport !== "미정" ? TRANSPORT_ICON[spec.transport] : null;
  const tag = "inline-flex h-6 items-center gap-1 rounded-md bg-ink-100 px-2 text-xs font-medium leading-none text-ink-600";
  // 내 닉네임을 맨 앞에
  const members = trip.participants.map((p) => p.nickname);
  const names = nickname && members.includes(nickname) ? [nickname, ...members.filter((n) => n !== nickname)] : members;

  return (
    <Link href={`/trip/${trip.id}`} className="group block text-left">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-ink-100">
        {region ? (
          <Image
            src={region.image}
            alt={`${region.name} 대표 이미지`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className={cn(
              "flex h-full items-center justify-center bg-gradient-to-br pb-10 text-4xl font-bold tracking-tight",
              FALLBACK_TONES[index % FALLBACK_TONES.length]
            )}
          >
            {spec?.region || "새 여행"}
          </div>
        )}
        {spec?.region && (
          <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-soft", regionPillTone(region))}>
            {spec.region}
          </span>
        )}
        {badge && (
          <span className={cn("absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-soft", badge.tone)}>{badge.label}</span>
        )}

        {/* 진행 단계: 칸 막대 + 지금 단계 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3.5 pt-10 text-white">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>
              <span className="opacity-70">{step.index + 1}단계 · </span>
              {steps[step.index].title}
            </span>
            <span className="opacity-70">
              {step.index + 1}/{step.total}
            </span>
          </div>
          <div className="mt-2 flex gap-1">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn("h-1 flex-1 rounded-full", s.state === "done" ? "bg-white" : i === step.index ? "bg-white/70" : "bg-white/25")}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1 px-1 pt-3">
        <div className="flex flex-wrap gap-1 pb-1">
          {spec?.start_date ? (
            <span className={tag}>
              <CalendarCheck className="block h-3 w-3" />
              {shortDate(spec.start_date)}
              {spec.end_date && spec.end_date !== spec.start_date && ` – ${shortDate(spec.end_date)}`}
            </span>
          ) : null}
          {spec && <span className={tag}>{spec.nights ? `${spec.nights}박 ${spec.days}일` : "당일치기"}</span>}
          {Transport && spec && (
            <span className={tag}>
              <Transport className="block h-3 w-3" />
              {spec.transport === "도보 위주" ? "도보" : spec.transport}
            </span>
          )}
        </div>
        <h3 className="truncate text-xl font-bold leading-snug tracking-tight">{title}</h3>
        <div className="flex items-center justify-between gap-2 pt-1 text-ink-800">
          {names.length ? <AuthorStory names={names} className="[&_.drop-shadow]:drop-shadow-none" /> : <span />}
          <span className="shrink-0 text-xs text-ink-400">{timeAgo(trip.updated_at)} 수정</span>
        </div>
      </div>
    </Link>
  );
}

/** 목록 맨 앞의 '새 여행 만들기' 카드 */
function NewTripCard() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await api.createTrip();
          router.push(`/trip/${id}`);
        } catch (e) {
          toast.error((e as ApiError).message);
          setBusy(false);
        }
      }}
      className="group flex h-24 w-full items-center justify-center gap-4 rounded-[1.25rem] sm:aspect-[4/3] sm:h-auto sm:flex-col sm:gap-3 border-2 border-dashed border-ink-200 bg-gradient-to-br from-lilac-50 via-white to-sky-50 text-center transition-colors hover:border-ink-300"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-ink-900 shadow-soft sm:h-14 sm:w-14 transition-transform duration-300 group-hover:scale-110">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
      </span>
      <span className="space-y-0.5 text-left sm:text-center">
        <span className="block font-bold">새 여행 만들기</span>
        <span className="block text-xs text-ink-500">링크 하나로 친구들과 함께 계획해요</span>
      </span>
    </button>
  );
}

function TripSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="aspect-[4/3] rounded-[1.25rem] bg-ink-100" />
      <div className="h-5 w-24 rounded-md bg-ink-100" />
      <div className="h-6 w-3/4 rounded-md bg-ink-100" />
    </div>
  );
}

const GRID = "grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3";

function MyTrips({ trips, sessions }: ReturnType<typeof useMyTrips>) {
  if (trips === null)
    return (
      <div className={GRID}>
        {[0, 1, 2].map((i) => (
          <TripSkeleton key={i} />
        ))}
      </div>
    );

  if (!trips.length)
    return (
      <EmptyState icon={MapIcon} title="아직 참여한 여행이 없어요" description="새 여행을 만들거나 친구에게 받은 링크로 참여해 보세요.">
        <div className="w-full max-w-xs">
          <NewTripCard />
        </div>
      </EmptyState>
    );

  return (
    <div className={GRID}>
      <NewTripCard />
      {trips.map((trip, i) => (
        <MyTripCard key={trip.id} trip={trip} index={i} nickname={sessions[trip.id]?.nickname} />
      ))}
    </div>
  );
}

function MyPageInner() {
  const my = useMyTrips();
  const trips = my.trips;
  const stats = [
    { label: "참여한 여행", value: trips?.length, icon: Users, tone: "bg-lilac-100 text-lilac-600" },
    { label: "다가오는 여행", value: trips?.filter((t) => tripDDay(t.spec)?.label.startsWith("D-")).length, icon: CalendarCheck, tone: "bg-peach-100 text-peach-600" },
    { label: "확정한 일정", value: trips?.filter((t) => t.confirmed_plan_id).length, icon: Check, tone: "bg-mint-100 text-mint-600" },
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-[1.75rem] font-bold tracking-tight sm:text-4xl">내 여행</h1>
          <p className="text-sm text-ink-500 sm:text-base">이 기기에서 참여한 여행을 모아 봤어요.</p>
        </div>

        {/* 한눈에 보기 */}
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-3xl bg-ink-50 px-2 py-4 sm:flex-row sm:gap-3 sm:px-4 sm:text-left"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-ink-500">{label}</span>
                <span className="block text-xl font-bold tabular-nums">{value ?? "–"}</span>
              </span>
            </div>
          ))}
        </div>
      </header>

      <MyTrips {...my} />
    </div>
  );
}

/** 내 여행 (로그인 없이 이 기기에 저장된 참여 정보 기준). 북마크는 상단 '북마크' 메뉴에서 */
export default function MyPage() {
  return (
    <Shell backHref="/" title="내 여행">
      <MyPageInner />
      <Toaster />
    </Shell>
  );
}
