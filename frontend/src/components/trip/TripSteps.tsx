"use client";

import { ArrowRight, Check } from "@/components/ui/icons";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "plan" | "map" | "spec" | "people";
type State = "done" | "current" | "todo";

interface Step {
  title: string;
  hint: string;
  tab: Tab;
  state: State;
}

/** 조건에서 정한 인원 (미정이면 null) */
export function plannedHeadcount(trip: Trip): number | null {
  const spec = trip.spec;
  return spec && !spec.headcount_undecided && spec.headcount ? spec.headcount : null;
}

/** "참여 2/4명" (인원 미정이면 "참여 2명") */
export function joinedLabel(trip: Trip): string {
  const planned = plannedHeadcount(trip);
  const joined = trip.participants.length;
  return planned ? `참여 ${joined}/${planned}명` : `참여 ${joined}명`;
}

/** 방 상태로 각 단계의 진행 여부를 계산한다 */
export function stepsOf(trip: Trip): Step[] {
  const hasSpec = !!trip.spec;
  // 정한 인원이 다 모이면 완료, 인원 미정이면 친구가 1명 이상 들어오면 완료
  const planned = plannedHeadcount(trip);
  const invited = planned ? trip.participants.length >= planned : trip.participants.length >= 2;
  const generated = trip.plans.length > 0;
  const items = trip.plans.flatMap((p) => p.days.flatMap((d) => d.items));
  const discussed = items.some((i) => Object.keys(i.votes).length > 0 || i.comments.length > 0 || i.history.length > 0);

  const raw: Omit<Step, "state">[] = [
    { title: "조건 입력", hint: "지역·날짜·테마를 정해요", tab: "spec" },
    { title: "친구 초대", hint: planned ? `${trip.participants.length}/${planned}명 참여했어요` : "링크로 친구 취향을 모아요", tab: "people" },
    { title: "AI 일정", hint: "1안·2안을 받아봐요", tab: "plan" },
    { title: "투표·수정", hint: "좋아요·코멘트로 함께 다듬어요", tab: "plan" },
    { title: "확정·공유", hint: "슬라이드·엑셀로 공유해요", tab: "plan" },
  ];
  const done = [hasSpec, invited, generated, discussed, false];
  // 지금 할 단계: 앞에서부터 처음으로 끝나지 않은 단계 (친구 초대는 건너뛰고 진행할 수 있다)
  let current = done.findIndex((d, i) => !d && !(i === 1 && generated));
  if (current === -1) current = raw.length - 1;
  return raw.map((s, i) => ({ ...s, state: done[i] ? "done" : i === current ? "current" : "todo" }));
}

/** 지금 단계 라벨: "2/5 친구 초대" */
export function currentStepLabel(trip: Trip): { label: string; index: number; total: number } {
  const steps = stepsOf(trip);
  const index = Math.max(0, steps.findIndex((s) => s.state === "current"));
  return { label: `${index + 1}/${steps.length} ${steps[index].title}`, index, total: steps.length };
}

/**
 * 여행 계획 단계: 왼쪽은 '지금 할 일', 오른쪽은 점과 선으로 이은 진행 막대.
 * 단계를 누르면 그 단계를 하는 탭으로 이동한다.
 */
export function TripSteps({ trip, onGo, className }: { trip: Trip; onGo: (tab: Tab) => void; className?: string }) {
  const steps = stepsOf(trip);
  const index = Math.max(0, steps.findIndex((s) => s.state === "current"));
  const current = steps[index];

  return (
    <div className={cn("flex flex-col gap-5 rounded-[1.75rem] bg-ink-50 p-5 lg:flex-row lg:items-center lg:gap-10 lg:p-6", className)}>
      <button type="button" onClick={() => onGo(current.tab)} className="group flex items-center gap-3 text-left lg:w-72 lg:shrink-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-sm font-bold text-white">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-500">지금 할 일</span>
          <span className="block truncate font-bold">{current.title}</span>
          <span className="block truncate text-xs text-ink-500">{current.hint}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
      </button>

      <ol aria-label="여행 계획 단계" className="grid flex-1 grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            {/* 이전 단계와 잇는 선 */}
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 rounded-full",
                  steps[i - 1].state === "done" ? "bg-mint-400" : "bg-ink-200"
                )}
              />
            )}
            <button
              type="button"
              onClick={() => onGo(s.tab)}
              aria-current={s.state === "current" ? "step" : undefined}
              className="relative z-10 flex w-full flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-110",
                  s.state === "done" && "bg-mint-500 text-white",
                  s.state === "current" && "bg-ink-900 text-white ring-4 ring-ink-900/10",
                  s.state === "todo" && "bg-white text-ink-400 ring-1 ring-inset ring-ink-200"
                )}
              >
                {s.state === "done" ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[0.6875rem] font-semibold sm:text-xs",
                  s.state === "current" ? "text-ink-900" : s.state === "done" ? "text-ink-600" : "text-ink-400"
                )}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
