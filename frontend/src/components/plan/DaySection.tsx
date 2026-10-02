"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, Plus, ThumbsDown, ThumbsUp } from "@/components/ui/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DragHandle, LodgingRow, PlaceCard } from "@/components/plan/PlaceCard";
import { api } from "@/lib/api";
import { dayLabel, endTime } from "@/lib/format";
import { mapLinks } from "@/lib/links";
import { dayColor, placeOrder } from "@/lib/route";
import { useTripStore } from "@/lib/store";
import type { DayPlan, Participant, PlanItem, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DaySectionProps {
  planId: string;
  day: DayPlan;
  participants: Participant[];
  view: "timeline" | "list";
  focusedId: string | null;
  onFocus: (id: string) => void;
  onAdd: () => void;
  onEdit: (item: PlanItem) => void;
  onDelete: (item: PlanItem) => void;
}

function SortablePlace({
  item,
  dotClass,
  order,
  date,
  participants,
  focused,
  onFocus,
  onEdit,
  onDelete,
}: {
  item: PlanItem;
  dotClass: string;
  order: number;
  date: string | null;
  participants: Participant[];
  focused: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: item.lodging, // 숙소 항목은 여행 조건에서 관리하므로 끌어서 옮기지 않는다
  });
  // dnd-kit 은 드래그 위치를 transform 으로 전달하므로 이 부분만 style 속성을 사용한다.
  const dndStyle = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li ref={setNodeRef} id={`item-${item.id}`} style={dndStyle} className={cn("relative scroll-mt-24", isDragging && "z-10")}>
      <span className={cn("absolute -left-[1.45rem] top-7 h-3 w-3 rounded-full ring-4 ring-white", dotClass)} />
      {item.lodging ? (
        <LodgingRow item={item} focused={focused} onFocus={onFocus} />
      ) : (
      <PlaceCard
        item={item}
        date={date}
        participants={participants}
        order={order}
        focused={focused}
        onFocus={onFocus}
        onEdit={onEdit}
        onDelete={onDelete}
        dragging={isDragging}
        dragHandle={<DragHandle {...attributes} {...listeners} />}
      />
      )}
    </li>
  );
}

function reorderLocally(trip: Trip, planId: string, dayNo: number, ids: string[]): Trip {
  return {
    ...trip,
    plans: trip.plans.map((p) =>
      p.id !== planId
        ? p
        : {
            ...p,
            days: p.days.map((d) => {
              if (d.day !== dayNo) return d;
              const byId = new Map(d.items.map((i) => [i.id, i]));
              return { ...d, items: ids.map((id) => byId.get(id)!).filter(Boolean) };
            }),
          }
    ),
  };
}

export function DaySection({ planId, day, participants, view, focusedId, onFocus, onAdd, onEdit, onDelete }: DaySectionProps) {
  const trip = useTripStore((s) => s.trip);
  const color = dayColor(day.day);
  const setTrip = useTripStore((s) => s.setTrip);
  const mutate = useTripStore((s) => s.mutate);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!trip || !over || active.id === over.id) return;
    const ids = day.items.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const previous = trip;
    setTrip(reorderLocally(trip, planId, day.day, next)); // 낙관적 업데이트
    const ok = await mutate((token) => api.reorder(trip.id, token, planId, day.day, next));
    if (!ok) setTrip(previous);
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none", color.soft)}>
            <span className="text-[0.5625rem] font-bold uppercase tracking-wider">Day</span>
            <span className="text-base font-extrabold">{day.day}</span>
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight">{day.title || `${day.day}일차`}</h3>
            <p className="text-xs font-medium text-ink-400">{dayLabel(day).replace(/^Day \d+\s*·?\s*/, "") || `${day.items.filter((i) => !i.lodging).length}곳`}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus /> 추가
        </Button>
      </header>

      {day.items.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed border-ink-200 py-10 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-50"
        >
          <Plus className="h-4 w-4" /> 이 날의 첫 일정을 추가해 보세요
        </button>
      ) : view === "timeline" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="relative space-y-3 pl-6 before:absolute before:bottom-6 before:left-[0.45rem] before:top-6 before:w-0.5 before:rounded-full before:bg-ink-100">
              {day.items.map((item) => (
                <SortablePlace
                  key={item.id}
                  item={item}
                  dotClass={item.lodging ? "bg-lilac-300" : color.bg}
                  order={placeOrder(day, item.id)}
                  date={day.date}
                  participants={participants}
                  focused={focusedId === item.id}
                  onFocus={() => onFocus(item.id)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] border border-ink-200/80 bg-white">
          {day.items.map((item) => {
            const likes = Object.values(item.votes).filter((v) => v === "like").length;
            const dislikes = Object.values(item.votes).filter((v) => v === "dislike").length;
            return (
              <li
                key={item.id}
                id={`item-${item.id}`}
                onMouseEnter={() => item.lat !== null && onFocus(item.id)}
                className={cn(
                  "flex scroll-mt-24 items-center pr-2 transition-colors hover:bg-secondary/60 sm:pr-3",
                  focusedId === item.id && "bg-accent"
                )}
              >
                <button
                  type="button"
                  onClick={() => !item.lodging && onEdit(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left sm:gap-4 sm:pl-5"
                >
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums sm:w-24">
                    {item.start_time || "--:--"}
                    <span className="hidden font-normal text-muted-foreground sm:inline">
                      {endTime(item) && `–${endTime(item)}`}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.lodging ? `🏨 ${item.memo} · ${item.name}` : `${placeOrder(day, item.id)}. ${item.name}`}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{item.area || item.reason}</span>
                  </span>
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {item.category}
                  </Badge>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-0.5">
                      <ThumbsUp className="h-3 w-3" />
                      {likes}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <ThumbsDown className="h-3 w-3" />
                      {dislikes}
                    </span>
                  </span>
                </button>
                <a
                  href={mapLinks(item).naver}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${item.name} 지도 열기`}
                  className="ml-2 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
