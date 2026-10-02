"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, KeyRound, Loader2, UserPlus, UserRound } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLERGY_SUGGESTIONS,
  DISLIKE_SUGGESTIONS,
  PREFERENCE_SUGGESTIONS,
  TagInput,
} from "@/components/trip/chips";
import { Avatar } from "@/components/trip/people";
import { api, ApiError } from "@/lib/api";
import { toast, useSessionStore, useTripStore } from "@/lib/store";
import { DRINK_TYPES, DRINKING, type Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

const prefsSchema = {
  allergies: z.array(z.string()).max(20),
  dislikes: z.array(z.string()).max(20),
  preferred_tags: z.array(z.string()).max(20),
  drinking: z.enum(DRINKING).nullable(),
  drink_types: z.array(z.string()).max(20),
};
const EMPTY_PREFS = { allergies: [], dislikes: [], preferred_tags: [], drinking: null, drink_types: [] };

const joinSchema = z.object({
  nickname: z.string().trim().min(1, "닉네임을 입력해 주세요.").max(12, "12자 이내로 입력해 주세요."),
  pin: z.string().regex(/^\d{6}$/, "숫자 6자리를 입력해 주세요."),
  ...prefsSchema,
});
type JoinValues = z.infer<typeof joinSchema>;

const editSchema = z.object(prefsSchema);
type EditValues = z.infer<typeof editSchema>;

function PreferenceFields({
  control,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>알레르기 식재료</Label>
        <Controller
          control={control}
          name="allergies"
          render={({ field }) => (
            <TagInput
              tone="danger"
              value={field.value}
              onChange={field.onChange}
              suggestions={ALLERGY_SUGGESTIONS}
              placeholder="입력 후 Enter"
            />
          )}
        />
      </div>
      <div className="space-y-2">
        <Label>기피 음식</Label>
        <Controller
          control={control}
          name="dislikes"
          render={({ field }) => (
            <TagInput value={field.value} onChange={field.onChange} suggestions={DISLIKE_SUGGESTIONS} placeholder="입력 후 Enter" />
          )}
        />
      </div>
      <DrinkingFields control={control} />
      <div className="space-y-2">
        <Label>좋아하는 것</Label>
        <Controller
          control={control}
          name="preferred_tags"
          render={({ field }) => (
            <TagInput
              tone="positive"
              value={field.value}
              onChange={field.onChange}
              suggestions={PREFERENCE_SUGGESTIONS}
              placeholder="입력 후 Enter"
            />
          )}
        />
      </div>
    </div>
  );
}

const DRINK_HINT: Record<(typeof DRINKING)[number], string> = {
  "안 마셔요": "술집은 빼고 짜요",
  "가볍게 한두 잔": "저녁에 곁들이는 정도",
  "술자리 좋아요": "저녁 술자리를 넣어요",
};

/** 음주 여부 + 좋아하는 주종 (일정의 저녁 술자리·운전자 배려에 쓰인다) */
function DrinkingFields({
  control,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}) {
  return (
    <Controller
      control={control}
      name="drinking"
      render={({ field: drinking }) => (
        <div className="space-y-2.5">
          <Label>술은 어느 정도 마시나요?</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {DRINKING.map((d) => {
              const on = drinking.value === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => drinking.onChange(on ? null : d)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 text-center transition-all",
                    on ? "border-ink-900 bg-white" : "border-transparent bg-ink-50 hover:bg-ink-100"
                  )}
                >
                  <span className="text-sm font-semibold">{d}</span>
                  <span className="text-[0.6875rem] text-ink-400">{DRINK_HINT[d]}</span>
                </button>
              );
            })}
          </div>
          {drinking.value && drinking.value !== "안 마셔요" && (
            <Controller
              control={control}
              name="drink_types"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="w-full text-xs text-ink-500">좋아하는 술 (여러 개 선택)</span>
                  {DRINK_TYPES.map((t) => {
                    const on = field.value.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(on ? field.value.filter((x: string) => x !== t) : [...field.value, t])}
                        className={cn(
                          "h-8 rounded-full px-3 text-xs font-semibold transition-colors",
                          on ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          )}
        </div>
      )}
    />
  );
}

/** 링크로 들어온 사용자가 닉네임 + 6자리 PIN 으로 참여(또는 재입장)하는 모달 */
export function JoinDialog({ tripId, open }: { tripId: string; open: boolean }) {
  const setSession = useSessionStore((s) => s.setSession);
  const load = useTripStore((s) => s.load);
  const participants = useTripStore((s) => s.trip?.participants ?? []);

  const form = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { nickname: "", pin: "", ...EMPTY_PREFS },
  });
  // 이미 참여자가 있으면 "프로필 선택" 화면부터 보여준다.
  const [mode, setMode] = React.useState<"pick" | "new">("new");
  const [selected, setSelected] = React.useState<Participant | null>(null);
  const hasParticipants = participants.length > 0;
  React.useEffect(() => {
    if (open) setMode(hasParticipants ? "pick" : "new");
    // 모달이 열릴 때만 초기 화면을 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nickname = form.watch("nickname");
  const duplicate = mode === "new" ? participants.find((p) => p.nickname === nickname.trim()) : undefined;

  const pickProfile = (p: Participant) => {
    setSelected(p);
    form.reset({ nickname: p.nickname, pin: "", ...EMPTY_PREFS });
  };

  const startNew = () => {
    setSelected(null);
    setMode("new");
    form.reset({ nickname: "", pin: "", ...EMPTY_PREFS });
  };

  const backToList = () => {
    setSelected(null);
    setMode("pick");
    form.reset({ nickname: "", pin: "", ...EMPTY_PREFS });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await api.join(tripId, values);
      setSession(tripId, { token: res.token, participantId: res.participant.id, nickname: res.participant.nickname });
      toast(`${res.participant.nickname}님, ${selected ? "다시 오셨네요!" : "환영해요!"}`);
      await load(tripId);
    } catch (e) {
      form.setError("pin", { message: (e as ApiError).message });
    }
  });

  const pinField = (
    <div className="space-y-2">
      <Label htmlFor="pin">{selected ? "PIN 6자리" : "간이 PIN (6자리)"}</Label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pin"
          className="pl-10 tracking-[0.4em]"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          autoComplete="off"
          autoFocus={!!selected}
          {...form.register("pin", {
            onChange: (e) => form.setValue("pin", e.target.value.replace(/\D/g, "").slice(0, 6)),
          })}
        />
      </div>
      {form.formState.errors.pin && (
        <p className="whitespace-pre-line text-xs text-destructive">{form.formState.errors.pin.message}</p>
      )}
    </div>
  );

  const submitButton = (label: string) => (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );

  return (
    <Dialog open={open}>
      <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        {mode === "pick" && !selected ? (
          <>
            <DialogHeader>
              <DialogTitle>누구세요?</DialogTitle>
              <DialogDescription>이미 참여했다면 내 프로필을 고르고 PIN만 입력하면 돼요.</DialogDescription>
            </DialogHeader>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {participants.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pickProfile(p)}
                    className="flex w-full items-center gap-2.5 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-ink-300 hover:bg-secondary"
                  >
                    <Avatar person={p} />
                    <span className="truncate text-sm font-medium">{p.nickname}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="lg" onClick={startNew}>
              <UserPlus /> 처음이에요 · 새로 참여하기
            </Button>
          </>
        ) : selected ? (
          <>
            <DialogHeader>
              <DialogTitle>다시 입장하기</DialogTitle>
              <DialogDescription>처음 참여할 때 정한 PIN을 입력해 주세요.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                <Avatar person={selected} />
                <span className="flex-1 font-medium">{selected.nickname}</span>
                <Button type="button" variant="ghost" size="sm" onClick={backToList}>
                  <ArrowLeft /> 다른 프로필
                </Button>
              </div>
              {pinField}
              <DialogFooter>{submitButton("입장하기")}</DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>여행에 참여하기</DialogTitle>
              <DialogDescription>
                로그인 없이 닉네임과 6자리 PIN만 있으면 돼요. 다른 기기에서는 프로필을 고르고 같은 PIN으로 들어올 수 있어요.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nickname">닉네임</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="nickname" className="pl-10" placeholder="예: 민수" autoComplete="off" {...form.register("nickname")} />
                  </div>
                  {form.formState.errors.nickname && (
                    <p className="text-xs text-destructive">{form.formState.errors.nickname.message}</p>
                  )}
                </div>
                {pinField}
              </div>

              {duplicate ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <span>이미 있는 프로필이에요.</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => pickProfile(duplicate)}>
                    {duplicate.nickname}(으)로 입장하기
                  </Button>
                </div>
              ) : (
                <PreferenceFields control={form.control} />
              )}

              <DialogFooter className="items-center sm:justify-between">
                {hasParticipants ? (
                  <Button type="button" variant="ghost" onClick={backToList}>
                    <ArrowLeft /> 프로필 목록
                  </Button>
                ) : (
                  <span />
                )}
                {submitButton("참여하기")}
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 참여 후 내 음식 취향을 수정하는 모달 */
export function PreferencesDialog({
  me,
  open,
  onOpenChange,
}: {
  me: Participant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutate = useTripStore((s) => s.mutate);
  const tripId = useTripStore((s) => s.trip?.id);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: {
      allergies: me.allergies,
      dislikes: me.dislikes,
      preferred_tags: me.preferred_tags,
      drinking: me.drinking ?? null,
      drink_types: me.drink_types ?? [],
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!tripId) return;
    const ok = await mutate((token) => api.updatePreferences(tripId, token, values), "취향을 저장했어요");
    if (ok) onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{me.nickname}님의 취향</DialogTitle>
          <DialogDescription>AI가 일정을 만들 때 모든 참여자의 취향을 함께 고려해요.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <PreferenceFields control={form.control} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
