"use client";

import * as React from "react";
import { Sparkles, Users } from "@/components/ui/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/trip/people";
import { specSummary } from "@/lib/format";
import type { Trip } from "@/lib/types";

const STEPS = [
  "모두의 취향과 알레르기를 정리하는 중…",
  "여행 테마에 맞는 장소를 고르는 중…",
  "동선과 영업시간을 맞추는 중…",
  "1안과 2안을 비교해 다듬는 중…",
];

export function GeneratingCard() {
  const [step, setStep] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const sec = Math.floor((Date.now() - started) / 1000);
      setElapsed(sec);
      setStep(Math.min(Math.floor(sec / 8), STEPS.length - 1));
    }, 250);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-14 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
          <Sparkles className="h-7 w-7 animate-pulse" />
          <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
        </span>
        <div className="space-y-1.5">
          <p className="font-semibold">AI가 여행 계획을 만들고 있어요</p>
          <p key={step} className="animate-fade-up text-sm text-muted-foreground">
            {STEPS[step]}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="rounded-full bg-secondary px-4 py-1.5 font-mono text-lg font-semibold tabular-nums" aria-live="off">
            {mm}:{ss}
          </span>
          <p className="text-xs text-muted-foreground/70">
            {elapsed < 60 ? "보통 30초~1분 정도 걸려요" : "AI 서버가 붐벼서 조금 더 걸리고 있어요…"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** 여행 조건과 참여자 취향을 요약하고 AI 생성을 시작하는 패널 */
export function GeneratePanel({ trip, onGenerate, onEditSpec }: { trip: Trip; onGenerate: () => void; onEditSpec: () => void }) {
  const spec = trip.spec!;
  const allergies = [...new Set(trip.participants.flatMap((p) => p.allergies))];
  const dislikes = [...new Set(trip.participants.flatMap((p) => p.dislikes))];

  return (
    <Card>
      <CardContent className="space-y-6 p-5 sm:p-7">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{specSummary(spec)}</p>
          <div className="flex flex-wrap gap-1.5">
            {spec.themes.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4" /> 함께하는 사람 {trip.participants.length}명
          </p>
          <div className="flex flex-wrap gap-2">
            {trip.participants.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-sm">
                <Avatar person={p} size="sm" />
                {p.nickname}
              </span>
            ))}
          </div>
          {(allergies.length > 0 || dislikes.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allergies.map((a) => (
                <Badge key={a} variant="destructive">
                  알레르기 · {a}
                </Badge>
              ))}
              {dislikes.map((d) => (
                <Badge key={d} variant="muted">
                  기피 · {d}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            아직 참여하지 않은 친구가 있다면 초대 링크를 보내 취향을 먼저 받아보세요.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onEditSpec}>
            조건 수정
          </Button>
          <Button size="lg" onClick={onGenerate}>
            <Sparkles /> AI 여행 계획 만들기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
