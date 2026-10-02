"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlarmClockOff,
  AlertTriangle,
  BadgeCheck,
  BedDouble,
  CalendarCheck,
  CalendarX2,
  Clock,
  ExternalLink,
  GripVertical,
  Lightbulb,
  MapPin,
  MoreHorizontal,
  Parking,
  Pencil,
  StickyNote,
  Trash2,
  UtensilsCrossed,
} from "@/components/ui/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentThread, CommentToggle, HistoryLabel, VoteButtons } from "@/components/plan/feedback";
import { useTripStore } from "@/lib/store";
import { categoryStyle } from "@/lib/styles";
import { businessStatus, endTime, formatDuration } from "@/lib/format";
import { mapLinks, reservationLinks } from "@/lib/links";
import type { Participant, PlanItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT = {
  open: "mint",
  break: "butter",
  closed: "rose",
  dayoff: "rose",
  unknown: "secondary",
} as const;

/** 서비스별 상징 색 (카카오 옐로, 네이버 그린, 구글 블루, 캐치테이블 오렌지) */
const BRAND = {
  kakao: "bg-[#FEE500] text-[#191919]",
  naver: "bg-[#03C75A] text-white",
  google: "bg-white text-[#1A73E8] ring-1 ring-inset ring-[#d2e3fc]",
  catchtable: "bg-[#FF5A1F] text-white",
  naverBooking: "bg-[#e6f9ee] text-[#03a64b] ring-1 ring-inset ring-[#b5ecca]",
};

function LinkChip({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-100 px-3.5 text-xs font-semibold text-ink-700 transition-colors hover:brightness-95",
        className
      )}
    >
      {children}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}

export interface PlaceCardProps {
  item: PlanItem;
  date: string | null;
  participants: Participant[];
  onEdit: () => void;
  onDelete: () => void;
  dragHandle?: React.ReactNode;
  dragging?: boolean;
  /** 그날의 방문 순서 (지도 마커 번호와 동일) */
  order?: number;
  focused?: boolean;
  onFocus?: () => void;
}

export function PlaceCard({
  item,
  date,
  participants,
  onEdit,
  onDelete,
  dragHandle,
  dragging,
  order,
  focused,
  onFocus,
}: PlaceCardProps) {
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const status = businessStatus(item, date);
  const maps = mapLinks(item);
  const reserve = reservationLinks(item);
  const end = endTime(item);
  const transport = useTripStore((s) => s.trip?.spec?.transport);
  const tone = categoryStyle(item.category);
  const CategoryIcon = tone.icon;

  return (
    <article
      className={cn(
        "rounded-[1.25rem] border border-ink-200/80 bg-white p-4 transition-all sm:p-5 lg:hover:shadow-lift",
        dragging && "shadow-lift ring-2 ring-ink-900/10",
        focused && "border-ink-900 ring-1 ring-ink-900"
      )}
    >
      <header className="flex items-start gap-3">
        {dragHandle}
        {/* 카테고리 아이콘 칩 + 방문 순서 */}
        <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone.soft)}>
          <CategoryIcon className="h-[18px] w-[18px]" />
          {order !== undefined && order > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-900 px-1 text-[0.625rem] font-bold text-white ring-2 ring-white">
              {order}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-500">
            {item.start_time && (
              <span className="inline-flex items-center gap-1 font-bold text-ink-900 tabular-nums">
                {item.start_time}
                {end && <span className="font-medium text-ink-400">–{end}</span>}
              </span>
            )}
            <span className="text-ink-300">·</span>
            <span>{item.category}</span>
            <span className="text-ink-300">·</span>
            <span>{formatDuration(item.duration_minutes)}</span>
            {item.custom && <Badge variant="secondary">직접 추가</Badge>}
            {item.verified === false && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge variant="butter">
                      <AlertTriangle /> 장소 확인 필요
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>카카오맵에서 이 장소를 찾지 못했어요. 폐업했거나 AI가 이름을 잘못 알고 있을 수 있어요.</TooltipContent>
              </Tooltip>
            )}
          </div>
          <h3 className="flex items-center gap-1.5 text-[1.0625rem] font-bold leading-snug tracking-tight sm:text-lg">
            {item.name}
            {item.verified === true && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-mint-500" aria-label="카카오맵에서 확인된 장소" />
                </TooltipTrigger>
                <TooltipContent>카카오맵에서 확인된 장소예요</TooltipContent>
              </Tooltip>
            )}
          </h3>
          {(item.address || item.area) && (
            <p className="flex items-center gap-1 text-xs text-ink-500">
              <MapPin className="h-3 w-3 shrink-0 text-ink-400" />
              <span className="truncate">{item.address || item.area}</span>
              {item.lat !== null && onFocus && (
                <button
                  type="button"
                  onClick={onFocus}
                  className="ml-1 hidden shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 font-semibold text-ink-700 hover:bg-ink-200 lg:inline"
                >
                  지도
                </button>
              )}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-9 w-9 text-ink-400" aria-label="일정 메뉴">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> 수정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 /> 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {item.reason && <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.reason}</p>}

      {(item.open_time || item.break_start || item.closed_days.length > 0 || status.kind !== "unknown") && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant={STATUS_VARIANT[status.kind]}>
            {status.kind === "open" ? <CalendarCheck /> : status.kind === "unknown" ? <Clock /> : <CalendarX2 />}
            {status.label}
          </Badge>
          {item.open_time && item.close_time && (
            <Badge variant="secondary">
              영업 {item.open_time}–{item.close_time}
            </Badge>
          )}
          {item.break_start && item.break_end && (
            <Badge variant="secondary">
              <AlarmClockOff />
              브레이크 {item.break_start}–{item.break_end}
            </Badge>
          )}
          {item.closed_days.length > 0 && <Badge variant="secondary">{item.closed_days.join("·")} 휴무</Badge>}
          {item.reservation_recommended && (
            <Badge variant="peach">
              <UtensilsCrossed />
              예약 권장
            </Badge>
          )}
        </div>
      )}

      {transport === "자차" && <ParkingInfo item={item} />}

      {(item.tip || item.memo) && (
        <div className="mt-3 space-y-1.5">
          {item.tip && (
            <p className="flex gap-1.5 text-xs text-ink-500">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-butter-500" />
              {item.tip}
            </p>
          )}
          {item.memo && (
            <p className="flex gap-1.5 rounded-2xl bg-butter-50 px-3 py-2.5 text-xs text-butter-700">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-wrap">{item.memo}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <LinkChip href={maps.kakao} className={BRAND.kakao}>
          카카오맵
        </LinkChip>
        <LinkChip href={maps.naver} className={BRAND.naver}>
          네이버지도
        </LinkChip>
        <LinkChip href={maps.google} className={BRAND.google}>
          구글 지도
        </LinkChip>
        {item.on_catchtable && (
          <LinkChip href={reserve.catchtable} className={BRAND.catchtable}>
            캐치테이블
          </LinkChip>
        )}
        {item.on_naver_booking && (
          <LinkChip href={reserve.naverBooking} className={BRAND.naverBooking}>
            네이버 예약
          </LinkChip>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
        <div className="min-w-0 flex-1">
          <HistoryLabel item={item} />
        </div>
        <div className="flex items-center gap-1.5">
          <VoteButtons item={item} participants={participants} />
          <CommentToggle count={item.comments.filter((c) => !c.deleted).length} open={commentsOpen} onClick={() => setCommentsOpen((v) => !v)} />
        </div>
      </footer>

      {commentsOpen && (
        <div className="mt-3 animate-fade-up">
          <CommentThread item={item} participants={participants} />
        </div>
      )}
    </article>
  );
}

/** 자차 여행: AI 가 아는 주차 요금/무료 시간 + 카카오에서 찾은 가장 가까운 주차장 */
function ParkingInfo({ item }: { item: PlanItem }) {
  const lot = item.nearby_parking;
  const known = item.parking !== "모름" || item.parking_note;
  if (!known && !lot) return null;
  const tone = {
    무료: "bg-mint-100 text-mint-700",
    유료: "bg-butter-100 text-butter-700",
    없음: "bg-peach-100 text-peach-500",
    모름: "bg-secondary text-muted-foreground",
  }[item.parking];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl bg-sky-50 px-3 py-2.5 text-xs text-ink-700">
      <Parking className="h-4 w-4 text-sky-500" />
      {known && (
        <>
          {item.parking !== "모름" && <span className={cn("rounded-full px-2 py-0.5 font-medium", tone)}>{item.parking === "없음" ? "자체 주차 없음" : `${item.parking} 주차`}</span>}
          {item.parking_note && <span>{item.parking_note}</span>}
          <span className="text-muted-foreground/70">(AI 정보 · 방문 전 확인)</span>
        </>
      )}
      {lot &&
        (lot.name ? (
          <a
            href={lot.place_url || mapLinks({ name: lot.name, search_keyword: lot.name, area: "" }).kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            가까운 주차장 {lot.distance_m < 1000 ? `${lot.distance_m}m` : `${(lot.distance_m / 1000).toFixed(1)}km`} · {lot.name}
            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
          </a>
        ) : (
          <span className="text-rose-600">반경 500m 안에 주차장이 없어요</span>
        ))}
    </div>
  );
}

/** 여행 조건의 숙소로 자동 생성된 체크인·출발·복귀·체크아웃 항목 */
export function LodgingRow({ item, focused, onFocus }: { item: PlanItem; focused?: boolean; onFocus?: () => void }) {
  const maps = mapLinks(item);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[1.5rem] border border-dashed border-lilac-200 bg-lilac-50 px-4 py-3",
        focused && "border-solid border-ink-900"
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac-100 text-lilac-700">
        <BedDouble className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{item.start_time}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="font-medium">{item.memo}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          {item.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.reason || item.address}</p>
      </div>
      {item.lat !== null && onFocus && (
        <button
          type="button"
          onClick={onFocus}
          className="hidden shrink-0 rounded-full px-2 py-1 text-xs font-medium hover:bg-card sm:block"
        >
          지도에서 보기
        </button>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={maps.kakao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${item.name} 카카오맵에서 보기`}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </TooltipTrigger>
        <TooltipContent>숙소는 &lsquo;조건&rsquo; 탭에서 바꿀 수 있어요</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="드래그하여 순서 변경"
      className="-ml-1 mt-0.5 cursor-grab touch-none rounded-lg p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
