"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Presentation,
  RefreshCw,
  Rows3,
} from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DaySection } from "@/components/plan/DaySection";
import { Avatar } from "@/components/trip/people";
import { MapPanel } from "@/components/plan/MapPanel";
import { ItemDialog, type ItemFormValues } from "@/components/plan/ItemDialog";
import { SlideView } from "@/components/plan/SlideView";
import { api } from "@/lib/api";
import { downloadTripXlsx } from "@/lib/exportXlsx";
import { dayColor } from "@/lib/route";
import { dayLabel, timeAgo } from "@/lib/format";
import { toast, useSessionStore, useTripStore } from "@/lib/store";
import type { DayPlan, PlanItem, PlanOption, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onOpenChange(false);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 카카오맵에서 찾지 못한 장소가 있으면 알리고, 근처 실제 장소로 바꾸거나 다시 생성하게 한다 */
function UnverifiedNotice({ trip, onRegenerate }: { trip: Trip; onRegenerate: () => void }) {
  const mutate = useTripStore((s) => s.mutate);
  const [busy, setBusy] = React.useState(false);
  const names = trip.plans.flatMap((p) => p.days.flatMap((d) => d.items)).filter((i) => i.verified === false);
  if (!names.length) return null;

  const replace = async () => {
    setBusy(true);
    await mutate((token) => api.replaceUnverified(trip.id, token), "근처 실제 장소로 바꿨어요");
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-butter-50 px-4 py-3.5 text-sm text-butter-700 sm:flex-row sm:items-center">
      <AlertTriangle className="hidden h-4 w-4 shrink-0 sm:block" />
      <p className="flex-1">
        카카오맵에서 찾을 수 없는 장소가 <b>{names.length}곳</b> 있어요 (
        {[...new Set(names.map((i) => i.name))].slice(0, 3).join(", ")}
        {names.length > 3 ? " 등" : ""}). 없어졌거나 AI가 잘못 알려준 곳일 수 있어요.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={replace} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          근처 실제 장소로 바꾸기
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate}>
          다시 만들기
        </Button>
      </div>
    </div>
  );
}

type Editing ={ mode: "add"; day: DayPlan } | { mode: "edit"; day: DayPlan; item: PlanItem } | null;

function PlanContent({
  trip,
  plan,
  view,
  dayFilter,
  focusedId,
  onFocus,
}: {
  trip: Trip;
  plan: PlanOption;
  view: "timeline" | "list";
  dayFilter: number | "all";
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const mutate = useTripStore((s) => s.mutate);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [deleting, setDeleting] = React.useState<PlanItem | null>(null);

  const days = dayFilter === "all" ? plan.days : plan.days.filter((d) => d.day === dayFilter);

  const submit = async (values: ItemFormValues) => {
    if (!editing) return false;
    if (editing.mode === "add") {
      return mutate((token) => api.addItem(trip.id, token, plan.id, editing.day.day, values), "일정을 추가했어요");
    }
    return mutate((token) => api.patchItem(trip.id, token, editing.item.id, values), "일정을 수정했어요");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-10">
        {days.map((day) => (
          <DaySection
            key={day.day}
            planId={plan.id}
            day={day}
            view={view}
            participants={trip.participants}
            focusedId={focusedId}
            onFocus={onFocus}
            onAdd={() => setEditing({ mode: "add", day })}
            onEdit={(item) => setEditing({ mode: "edit", day, item })}
            onDelete={(item) => setDeleting(item)}
          />
        ))}
      </div>

      <ItemDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        item={editing?.mode === "edit" ? editing.item : null}
        dayLabel={editing ? `${plan.label} · ${dayLabel(editing.day)}` : ""}
        onSubmit={submit}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="일정을 삭제할까요?"
        description={`'${deleting?.name ?? ""}'의 투표와 코멘트도 함께 사라져요.`}
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deleting) await mutate((token) => api.deleteItem(trip.id, token, deleting.id), "일정을 삭제했어요");
        }}
      />
    </div>
  );
}

function DayChips({
  plan,
  value,
  onChange,
}: {
  plan: PlanOption;
  value: number | "all";
  onChange: (day: number | "all") => void;
}) {
  if (plan.days.length < 2) return null;
  const options = [
    { key: "all" as const, label: "전체", dot: "", soft: "bg-white text-ink-700 ring-1 ring-inset ring-ink-200" },
    ...plan.days.map((d) => ({ key: d.day, label: `Day ${d.day}`, dot: dayColor(d.day).bg, soft: dayColor(d.day).soft })),
  ];
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors",
            value === opt.key ? "bg-ink-900 text-white" : cn(opt.soft, "hover:brightness-95")
          )}
        >
          {opt.dot && <span className={cn("h-2 w-2 rounded-full", opt.dot)} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 일정 확정: 참여자 모두가 같은 안에 '확정 동의'를 눌러야 확정된다 */
function ConfirmBar({ trip, plan }: { trip: Trip; plan: PlanOption }) {
  const mutate = useTripStore((s) => s.mutate);
  const myId = useSessionStore((s) => s.sessions[trip.id]?.participantId);
  const [busy, setBusy] = React.useState(false);
  const votes = trip.confirm_votes ?? {};
  const confirmed = trip.plans.find((p) => p.id === trip.confirmed_plan_id);
  const agreedHere = trip.participants.filter((p) => votes[p.id] === plan.id);
  const myVote = myId ? votes[myId] : undefined;

  const run = async (planId: string | null, message: string) => {
    setBusy(true);
    await mutate((token) => api.confirmPlan(trip.id, token, planId), message);
    setBusy(false);
  };

  // 누가 이 안에 동의했는지: 동의한 사람은 진하게 + 체크
  const people = (
    <div className="flex -space-x-1.5">
      {trip.participants.map((p) => {
        const ok = votes[p.id] === plan.id;
        return (
          <span key={p.id} className="relative" title={`${p.nickname} · ${ok ? "동의" : "아직"}`}>
            <Avatar person={p} size="sm" className={cn(!ok && "opacity-35 grayscale")} />
            {ok && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-mint-500 text-white ring-2 ring-white">
                <Check className="h-1.5 w-1.5" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );

  if (confirmed && confirmed.id === plan.id)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-mint-50 px-4 py-3 ring-1 ring-inset ring-mint-100">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-500 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          모두 동의해서 <b>{confirmed.label}</b>으로 확정했어요
          {trip.confirmed_at && <span className="text-ink-500"> · {timeAgo(trip.confirmed_at)}</span>}
        </p>
        {people}
        {myVote === plan.id && (
          <Button size="sm" variant="ghost" className="rounded-full" disabled={busy} onClick={() => run(null, "확정 동의를 취소했어요")}>
            동의 취소
          </Button>
        )}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-ink-50 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold">
          {plan.label} 확정 동의 {agreedHere.length}/{trip.participants.length}명
        </p>
        <p className="text-xs text-ink-500">
          {confirmed
            ? `지금은 ${confirmed.label}으로 확정돼 있어요. 모두 ${plan.label}에 동의하면 바뀌어요.`
            : "모두가 같은 안에 동의하면 일정이 확정돼요."}
        </p>
      </div>
      {people}
      {myVote === plan.id ? (
        <Button size="sm" variant="secondary" className="rounded-full" disabled={busy} onClick={() => run(null, "확정 동의를 취소했어요")}>
          동의 취소
        </Button>
      ) : (
        <Button size="sm" className="rounded-full" disabled={busy || !myId} onClick={() => run(plan.id, `${plan.label} 확정에 동의했어요`)}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          {myVote ? `${plan.label}으로 동의 바꾸기` : `${plan.label} 확정에 동의`}
        </Button>
      )}
    </div>
  );
}

export function PlanBoard({
  trip,
  onRegenerate,
  mobileView = "list",
  onShowList,
}: {
  trip: Trip;
  onRegenerate: () => Promise<void>;
  /** 모바일·태블릿에서 일정 목록 대신 지도만 보여줄지 */
  mobileView?: "list" | "map";
  /** 모바일 지도에서 장소를 눌렀을 때 목록 탭으로 돌아가기 */
  onShowList?: () => void;
}) {
  const [active, setActive] = React.useState(trip.plans[0]?.id ?? "A");
  const [view, setView] = React.useState<"timeline" | "list">("timeline");
  const [slidesOpen, setSlidesOpen] = React.useState(false);
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [dayFilter, setDayFilter] = React.useState<number | "all">("all");
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const activePlan = trip.plans.find((p) => p.id === active) ?? trip.plans[0];

  // 지도에서 마커를 누르면 해당 일정 카드로 스크롤 (모바일 지도 탭이면 목록으로 전환 후)
  const focusFromMap = (id: string) => {
    setFocusedId(id);
    const scroll = () => document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (mobileView === "map" && window.matchMedia("(max-width: 1023px)").matches) {
      onShowList?.();
      setTimeout(scroll, 350);
    } else scroll();
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await downloadTripXlsx(trip);
      toast("엑셀 파일을 내려받았어요");
    } catch {
      toast.error("엑셀 파일을 만들지 못했어요.");
    } finally {
      setExporting(false);
    }
  };

  const selectPlan = (id: string) => {
    setActive(id);
    setDayFilter("all");
    setFocusedId(null);
  };

  return (
    <div className="space-y-4">
      {trip.plan_source === "mock" && (
        <div className="flex gap-2.5 rounded-3xl bg-butter-50 px-4 py-3 text-sm text-butter-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            AI API 키가 설정되지 않아 <b>예시 일정</b>을 보여주고 있어요. 키를 설정하고 다시 생성하면 실제 장소로
            추천받을 수 있어요.
          </p>
        </div>
      )}

      {/* 섹션 제목 + 도구 (무엇을 하는 영역인지 한눈에) */}
      <div className={cn("flex flex-wrap items-end justify-between gap-3", mobileView === "map" && "hidden lg:flex")}>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">일정</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-ink-100 p-1">
            {(
              [
                { key: "timeline", icon: Rows3, label: "타임라인" },
                { key: "list", icon: LayoutList, label: "리스트" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                aria-label={label}
                onClick={() => setView(key)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                  view === key ? "bg-white text-ink-900 shadow-soft" : "text-ink-500"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button variant="secondary" className="h-11 rounded-full px-4" onClick={() => setSlidesOpen(true)} aria-label="슬라이드로 보기">
            <Presentation />
            <span className="hidden sm:inline">슬라이드</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-full" aria-label="더 보기">
                {exporting ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSlidesOpen(true)}>
                <Presentation /> 슬라이드로 보기
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportXlsx}>
                <FileSpreadsheet /> 엑셀로 내려받기
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmRegen(true)}>
                <RefreshCw /> AI로 다시 만들기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 1안 / 2안: 각 안의 제목·콘셉트가 보이는 카드 */}
      <div className="grid gap-2 sm:grid-cols-2">
        {trip.plans.map((p) => {
          const on = p.id === activePlan?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPlan(p.id)}
              aria-pressed={on}
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-[1.25rem] p-4 text-left transition-all",
                on ? "bg-white ring-2 ring-ink-900" : "bg-ink-50 hover:bg-ink-100",
                mobileView === "map" && !on && "hidden lg:flex"
              )}
            >
              <span
                className={cn(
                  "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-bold",
                  on ? "bg-ink-900 text-white" : "bg-white text-ink-500"
                )}
              >
                {p.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-1.5 font-bold", !on && "text-ink-600")}>
                  <span className="truncate">{p.title}</span>
                  {p.id === trip.confirmed_plan_id && (
                    <span className="shrink-0 rounded-md bg-mint-100 px-1.5 py-0.5 text-[0.6875rem] font-bold text-mint-700">확정</span>
                  )}
                </span>
                {p.concept && <span className="mt-0.5 block truncate text-xs text-ink-500">{p.concept}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {activePlan && (
        <div className={cn(mobileView === "map" && "hidden lg:block")}>
          <ConfirmBar trip={trip} plan={activePlan} />
        </div>
      )}

      <UnverifiedNotice trip={trip} onRegenerate={() => setConfirmRegen(true)} />

      {activePlan && (
        <div className="flex items-center gap-3">
          <span className="hidden shrink-0 text-xs font-bold text-ink-400 sm:block">날짜별</span>
          <DayChips plan={activePlan} value={dayFilter} onChange={setDayFilter} />
        </div>
      )}

      {/* PC: 좌측 일정 / 우측 지도(고정). 모바일·태블릿: 지도 탭에서만 지도 */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,44%)] lg:gap-10">
        {mobileView === "map" && activePlan && (
          <MapPanel
            trip={trip}
            plan={activePlan}
            dayFilter={dayFilter}
            focusedId={focusedId}
            onFocus={focusFromMap}
            className="h-[calc(100dvh-17rem)] min-h-[26rem] lg:hidden"
          />
        )}
        <div className={cn("min-w-0 pt-2", mobileView === "map" && "hidden lg:block")}>
          {activePlan && (
            <PlanContent
              key={activePlan.id}
              trip={trip}
              plan={activePlan}
              view={view}
              dayFilter={dayFilter}
              focusedId={focusedId}
              onFocus={setFocusedId}
            />
          )}
          {trip.generated_at && (
            <p className="mt-8 text-center text-xs text-ink-400">
              {trip.plan_source === "gemini" ? "AI" : "예시 데이터"}로 {timeAgo(trip.generated_at)} 생성 · 카드를 길게 눌러 끌면 순서를 바꿀 수 있어요
            </p>
          )}
        </div>
        {activePlan && (
          // PC: 화면 오른쪽 끝까지 이어지는 사이드 패널 (본문 오른쪽 여백만큼 바깥으로 확장)
          <aside className="-mb-16 hidden rounded-tl-3xl bg-ink-50 lg:-mr-10 lg:block 2xl:-mr-14">
            <MapPanel
              framed
              trip={trip}
              plan={activePlan}
              dayFilter={dayFilter}
              focusedId={focusedId}
              onFocus={focusFromMap}
              className="sticky top-16 h-[calc(100dvh-4rem)] p-5 2xl:p-7"
            />
          </aside>
        )}
      </div>

      {activePlan && <SlideView plan={activePlan} spec={trip.spec} open={slidesOpen} onOpenChange={setSlidesOpen} />}
      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="AI로 다시 만들까요?"
        description="현재 1안·2안과 투표, 코멘트, 직접 추가한 일정이 모두 새 계획으로 교체돼요."
        confirmLabel="다시 만들기"
        onConfirm={onRegenerate}
      />
    </div>
  );
}
