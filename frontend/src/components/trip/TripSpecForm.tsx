"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, Check, Loader2, MapPin, Minus, Plus } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChipGroup, ChipToggle } from "@/components/trip/chips";
import { LodgingsField } from "@/components/trip/LodgingField";
import { THEME_STYLE } from "@/lib/styles";
import { AGE_GROUPS, GENDER_MIX, THEMES, type TripSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRAVEL_MINUTES = [10, 20, 30, 45, 60] as const;
const TRANSPORT_LABEL: Record<string, string> = {
  대중교통: "대중교통·도보",
  자차: "자동차",
  "도보 위주": "도보",
  미정: "일반 이동",
};

const DURATION_PRESETS = [
  { label: "당일치기", nights: 0 },
  { label: "1박 2일", nights: 1 },
  { label: "2박 3일", nights: 2 },
  { label: "3박 4일", nights: 3 },
  { label: "4박 5일", nights: 4 },
];

const optionalTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .or(z.literal("").transform(() => null));

const specSchema = z
  .object({
    title: z.string().max(60),
    region: z.string().trim().min(1, "여행 지역을 입력해 주세요.").max(60),
    duration_mode: z.enum(["rough", "exact"]),
    nights: z.number().int().min(0).max(30),
    days: z.number().int().min(1).max(31),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    start_time: optionalTime,
    end_time: optionalTime,
    headcount: z.number().int().min(1).max(100).nullable(),
    headcount_undecided: z.boolean(),
    gender_mix: z.enum(GENDER_MIX),
    age_groups: z.array(z.enum(AGE_GROUPS)),
    themes: z.array(z.enum(THEMES)).min(1, "테마를 하나 이상 골라 주세요."),
    budget_level: z.enum(["알뜰", "보통", "여유"]),
    transport: z.enum(["대중교통", "자차", "도보 위주", "미정"]),
    max_travel_minutes: z.number().int().min(5).max(180),
    lodgings: z.array(
      z.object({
        name: z.string().min(1),
        address: z.string(),
        place_url: z.string(),
        lat: z.number().nullable(),
        lng: z.number().nullable(),
        check_in: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        check_out: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        nights: z.array(z.number().int().min(1)),
      })
    ),
    notes: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.duration_mode === "exact" && !v.start_date) {
      ctx.addIssue({ code: "custom", path: ["start_date"], message: "여행 날짜를 선택해 주세요." });
    }
    if (v.duration_mode === "exact" && v.start_date && v.end_date) {
      if (differenceInCalendarDays(parseISO(v.end_date), parseISO(v.start_date)) > 30) {
        ctx.addIssue({ code: "custom", path: ["start_date"], message: "최대 31일까지 계획할 수 있어요." });
      }
    }
  });

type SpecValues = z.input<typeof specSchema>;

export const DEFAULT_SPEC: TripSpec = {
  title: "",
  region: "",
  duration_mode: "rough",
  nights: 1,
  days: 2,
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
  headcount: 2,
  headcount_undecided: false,
  gender_mix: "미정",
  age_groups: [],
  themes: [],
  budget_level: "보통",
  transport: "미정",
  max_travel_minutes: 30,
  lodgings: [],
  notes: "",
};

function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-ink-100 p-1", disabled && "opacity-40")}>
      <Button type="button" variant="outline" size="icon" className="border-0" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus />
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums">
        {value}
        {suffix}
      </span>
      <Button type="button" variant="outline" size="icon" className="border-0" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus />
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[0.9375rem] font-bold">{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function TripSpecForm({
  initial,
  onSubmit,
  submitLabel = "저장하기",
}: {
  initial?: TripSpec | null;
  onSubmit: (spec: TripSpec) => Promise<void> | void;
  submitLabel?: string;
}) {
  const form = useForm<SpecValues>({
    resolver: zodResolver(specSchema),
    defaultValues: initial ?? DEFAULT_SPEC,
  });
  const { control, register, watch, setValue, formState } = form;
  const mode = watch("duration_mode");
  const nights = watch("nights");
  const undecided = watch("headcount_undecided");
  const startDate = watch("start_date");
  const endDate = watch("end_date");

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(specSchema.parse(values) as TripSpec);
  });

  const range = startDate
    ? { from: parseISO(startDate), to: endDate ? parseISO(endDate) : undefined }
    : undefined;

  return (
    <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="space-y-8 p-5 sm:p-8">
          <Field label="어디로 떠나나요?" error={formState.errors.region?.message}>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-12 pl-11 text-base" placeholder="예: 부산 해운대, 제주 서귀포, 도쿄" {...register("region")} />
            </div>
          </Field>

          <Field label="여행 이름" hint="선택">
            <Input placeholder="예: 대학 동기 가을 여행" {...register("title")} />
          </Field>

          <Field label="언제 떠나나요?" error={formState.errors.start_date?.message}>
            <Controller
              control={control}
              name="duration_mode"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="grid w-full grid-cols-2 sm:w-80">
                    <TabsTrigger value="rough">대략적인 기간</TabsTrigger>
                    <TabsTrigger value="exact">구체적인 날짜</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />

            {mode === "rough" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => (
                    <ChipToggle
                      key={p.label}
                      selected={nights === p.nights}
                      onClick={() => {
                        setValue("nights", p.nights);
                        setValue("days", p.nights + 1);
                      }}
                    >
                      {p.label}
                    </ChipToggle>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Stepper
                    value={nights}
                    min={0}
                    max={30}
                    suffix="박"
                    onChange={(v) => {
                      setValue("nights", v);
                      setValue("days", v + 1);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">{nights + 1}일 일정</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("h-12 w-full justify-start font-normal", !startDate && "text-muted-foreground")}
                    >
                      <CalendarDays />
                      {startDate
                        ? `${format(parseISO(startDate), "M월 d일 (EEE)", { locale: ko })}${
                            endDate && endDate !== startDate
                              ? ` – ${format(parseISO(endDate), "M월 d일 (EEE)", { locale: ko })}`
                              : ""
                          }`
                        : "날짜를 선택하세요"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="range"
                      selected={range}
                      disabled={{ before: new Date() }}
                      onSelect={(r) => {
                        const from = r?.from ? format(r.from, "yyyy-MM-dd") : null;
                        const to = r?.to ? format(r.to, "yyyy-MM-dd") : from;
                        setValue("start_date", from, { shouldValidate: formState.isSubmitted });
                        setValue("end_date", to);
                        if (r?.from) {
                          const days = differenceInCalendarDays(r.to ?? r.from, r.from) + 1;
                          setValue("days", Math.min(days, 31));
                          setValue("nights", Math.min(days - 1, 30));
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">첫날 도착 시각</span>
                    <Input type="time" {...register("start_time")} />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">마지막 날 출발 시각</span>
                    <Input type="time" {...register("end_time")} />
                  </div>
                </div>
              </div>
            )}
          </Field>

          {nights >= 1 && (
            <Field label="숙소" hint="선택 · 여러 곳 가능 · 예약했다면 일정에 체크인·체크아웃이 자동으로 들어가요">
              <Controller
                control={control}
                name="lodgings"
                render={({ field }) => (
                  <LodgingsField
                    value={field.value ?? []}
                    onChange={field.onChange}
                    region={watch("region")}
                    nights={nights}
                    startDate={mode === "exact" ? startDate : null}
                  />
                )}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-8 p-5 sm:p-8">
          <Field label="누구와 함께 가나요?">
            <div className="flex flex-wrap items-center gap-4">
              <Controller
                control={control}
                name="headcount"
                render={({ field }) => (
                  <Stepper
                    value={field.value ?? 2}
                    onChange={field.onChange}
                    min={1}
                    max={100}
                    suffix="명"
                    disabled={undecided}
                  />
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  control={control}
                  name="headcount_undecided"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
                인원 미정
              </label>
            </div>
          </Field>

          <Field label="성별 구성">
            <Controller
              control={control}
              name="gender_mix"
              render={({ field }) => <ChipGroup options={GENDER_MIX} value={field.value} onChange={field.onChange} />}
            />
          </Field>

          <Field label="연령대" hint="여러 개 선택 가능">
            <Controller
              control={control}
              name="age_groups"
              render={({ field }) => (
                <ChipGroup options={AGE_GROUPS} value={field.value} onChange={field.onChange} multiple />
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardContent className="space-y-8 p-5 sm:p-8">
          <Field label="어떤 여행을 원하나요?" hint="여러 개 선택 가능" error={formState.errors.themes?.message}>
            <Controller
              control={control}
              name="themes"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {THEMES.map((theme) => {
                    const { icon: Icon, soft } = THEME_STYLE[theme];
                    const selected = field.value.includes(theme);
                    return (
                      <button
                        key={theme}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          field.onChange(selected ? field.value.filter((t) => t !== theme) : [...field.value, theme])
                        }
                        className={cn(
                          "flex flex-col items-start gap-3 rounded-3xl border-2 p-4 text-left transition-all active:scale-[0.97]",
                          selected ? "border-ink-900 bg-white" : "border-transparent bg-ink-50 hover:bg-ink-100"
                        )}
                      >
                        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", soft)}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="flex w-full items-center justify-between text-sm font-semibold">
                          {theme}
                          {selected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </Field>

          <div className="grid gap-7 sm:grid-cols-2">
            <Field label="예산">
              <Controller
                control={control}
                name="budget_level"
                render={({ field }) => (
                  <ChipGroup options={["알뜰", "보통", "여유"] as const} value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field label="이동 수단">
              <Controller
                control={control}
                name="transport"
                render={({ field }) => (
                  <ChipGroup
                    options={["대중교통", "자차", "도보 위주", "미정"] as const}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label="장소 간 최대 이동 시간"
            hint={`${TRANSPORT_LABEL[watch("transport")]} 기준 · 이보다 먼 곳은 추천하지 않아요`}
          >
            <Controller
              control={control}
              name="max_travel_minutes"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_MINUTES.map((m) => (
                    <ChipToggle key={m} selected={field.value === m} onClick={() => field.onChange(m)}>
                      {m < 60 ? `${m}분` : `${m / 60}시간`} 이내
                    </ChipToggle>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field label="AI에게 추가로 요청할 점" hint="선택">
            <Textarea
              rows={3}
              placeholder="예: 부모님과 함께라 많이 걷지 않았으면 해요. 둘째 날 저녁은 바다가 보이는 곳이면 좋겠어요."
              {...register("notes")}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 flex justify-end lg:bottom-6 xl:col-span-2">
        <Button type="submit" size="lg" className="w-full shadow-lift sm:w-auto sm:px-10" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
