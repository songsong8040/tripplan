"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "@/components/ui/icons";

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
import { Textarea } from "@/components/ui/textarea";
import { ChipGroup } from "@/components/trip/chips";
import { CATEGORIES, type PlanItem } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "장소명을 입력해 주세요.").max(60),
  category: z.enum(CATEGORIES),
  start_time: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "시간 형식이 올바르지 않아요."),
  duration_minutes: z.number({ message: "숫자를 입력해 주세요." }).int().min(0).max(1440),
  memo: z.string().max(300),
});
export type ItemFormValues = z.infer<typeof schema>;

/** 일정 추가/수정 모달. item 이 있으면 수정 모드 */
export function ItemDialog({
  open,
  onOpenChange,
  item,
  dayLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PlanItem | null;
  dayLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
}) {
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(schema),
    values: {
      name: item?.name ?? "",
      category: item?.category ?? "관광지",
      start_time: item?.start_time ?? "",
      duration_minutes: item?.duration_minutes ?? 60,
      memo: item?.memo ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    if (await onSubmit(values)) onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "일정 수정" : "일정 추가"}</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="item-name">장소명</Label>
            <Input id="item-name" placeholder="예: 해운대 블루라인파크" {...form.register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>카테고리</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => <ChipGroup options={CATEGORIES} value={field.value} onChange={field.onChange} />}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-time">시작 시각</Label>
              <Input id="item-time" type="time" {...form.register("start_time")} />
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-duration">체류 시간(분)</Label>
              <Input
                id="item-duration"
                type="number"
                inputMode="numeric"
                min={0}
                step={10}
                {...form.register("duration_minutes", { valueAsNumber: true })}
              />
              {errors.duration_minutes && <p className="text-xs text-destructive">{errors.duration_minutes.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-memo">메모</Label>
            <Textarea id="item-memo" rows={3} placeholder="예: 창가 자리 요청, 입장권 미리 구매" {...form.register("memo")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {item ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
