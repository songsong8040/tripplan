"use client";

import * as React from "react";
import { History, Loader2, MessageCircle, Send, ThumbsDown, ThumbsUp } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar } from "@/components/trip/people";
import { api } from "@/lib/api";
import { clockTime, timeAgo } from "@/lib/format";
import { useSessionStore, useTripStore } from "@/lib/store";
import type { Participant, PlanItem, VoteValue } from "@/lib/types";
import { cn } from "@/lib/utils";

function useMe() {
  const tripId = useTripStore((s) => s.trip?.id);
  return useSessionStore((s) => (tripId ? s.sessions[tripId] : undefined));
}

/** 좋아요/싫어요 토글 + 투표한 사람 닉네임 툴팁 */
export function VoteButtons({ item, participants }: { item: PlanItem; participants: Participant[] }) {
  const me = useMe();
  const mutate = useTripStore((s) => s.mutate);
  const tripId = useTripStore((s) => s.trip?.id);
  const [pending, setPending] = React.useState(false);
  const names = new Map(participants.map((p) => [p.id, p.nickname]));
  const mine = me ? item.votes[me.participantId] : undefined;

  const voters = (value: VoteValue) =>
    Object.entries(item.votes)
      .filter(([, v]) => v === value)
      .map(([id]) => names.get(id) ?? "알 수 없음");

  const cast = async (value: VoteValue) => {
    if (!tripId || pending) return;
    setPending(true);
    await mutate((token) => api.vote(tripId, token, item.id, mine === value ? null : value));
    setPending(false);
  };

  const renderButton = (value: VoteValue) => {
    const list = voters(value);
    const active = mine === value;
    const Icon = value === "like" ? ThumbsUp : ThumbsDown;
    return (
      <Tooltip key={value}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => cast(value)}
            disabled={pending}
            aria-pressed={active}
            aria-label={value === "like" ? "좋아요" : "별로예요"}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-95",
              active
                ? value === "like"
                  ? "bg-mint-100 text-mint-700"
                  : "bg-rose-100 text-rose-600"
                : "bg-ink-100 text-ink-500 hover:text-ink-900"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="tabular-nums">{list.length}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {list.length ? list.join(", ") : value === "like" ? "첫 좋아요를 눌러보세요" : "아직 반대 의견이 없어요"}
        </TooltipContent>
      </Tooltip>
    );
  };

  return <div className="flex items-center gap-1.5">{(["like", "dislike"] as const).map(renderButton)}</div>;
}

/** 수정 이력 라벨: 가장 최근 수정 1건 + 전체 이력 팝오버 */
export function HistoryLabel({ item }: { item: PlanItem }) {
  const last = item.history[item.history.length - 1];
  if (!last) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-lilac-50 px-2.5 py-1 text-[0.6875rem] font-semibold text-lilac-700 transition-colors hover:bg-lilac-100"
        >
          <History className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {last.actor}님이 {clockTime(last.at)}에 {last.action}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">수정 이력</p>
        <ol className="space-y-2">
          {[...item.history].reverse().map((h, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{h.actor}</span> · {h.action}
              <span className="block text-muted-foreground">{timeAgo(h.at)} · {clockTime(h.at)}</span>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

export function CommentToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
        open ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500 hover:text-ink-900"
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

/** 코멘트 입력창 (새 코멘트 · 답글 · 수정 공용) */
function CommentInput({
  initial = "",
  placeholder,
  submitLabel,
  disabled,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [text, setText] = React.useState(initial);
  const [sending, setSending] = React.useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value || sending) return;
        setSending(true);
        const ok = await onSubmit(value);
        setSending(false);
        if (ok) setText("");
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
        className="h-10 bg-white text-sm"
      />
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
          취소
        </Button>
      )}
      <Button type="submit" size="sm" disabled={!text.trim() || sending || disabled} className="h-10 shrink-0">
        {sending ? <Loader2 className="animate-spin" /> : submitLabel === "보내기" ? <Send /> : submitLabel}
      </Button>
    </form>
  );
}

/** 닉네임 코멘트 스레드: 답글(한 단계) · 수정 · 삭제 */
export function CommentThread({ item, participants }: { item: PlanItem; participants: Participant[] }) {
  const me = useMe();
  const mutate = useTripStore((s) => s.mutate);
  const tripId = useTripStore((s) => s.trip?.id);
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const byId = new Map(participants.map((p) => [p.id, p]));

  const roots = item.comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => item.comments.filter((c) => c.parent_id === id);

  const add = (text: string, parentId?: string) =>
    tripId ? mutate((token) => api.addComment(tripId, token, item.id, text, parentId)) : Promise.resolve(false);

  const row = (c: (typeof item.comments)[number], rootId: string) => {
    const mine = me?.participantId === c.author_id;
    const person = byId.get(c.author_id) ?? { nickname: c.author, color: "" };
    if (c.deleted) {
      return <p className="py-1 text-[0.8125rem] text-ink-400">삭제된 코멘트예요</p>;
    }
    return (
      <div className="flex gap-2.5">
        <Avatar size="sm" person={person} />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-bold text-ink-900">{c.author}</span>
            <span className="ml-1.5 text-ink-400">
              {timeAgo(c.created_at)}
              {c.edited_at && " · 수정됨"}
            </span>
          </p>
          {editing === c.id ? (
            <div className="pt-1">
              <CommentInput
                initial={c.text}
                autoFocus
                placeholder="코멘트 수정"
                submitLabel="저장"
                onCancel={() => setEditing(null)}
                onSubmit={async (text) => {
                  const ok = tripId ? await mutate((token) => api.editComment(tripId, token, item.id, c.id, text)) : false;
                  if (ok) setEditing(null);
                  return ok;
                }}
              />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm text-ink-800">{c.text}</p>
          )}
          {editing !== c.id && me && (
            <div className="mt-1 flex gap-3 text-xs font-semibold text-ink-400">
              <button type="button" onClick={() => setReplyTo(replyTo === rootId ? null : rootId)} className="hover:text-ink-900">
                답글
              </button>
              {mine && (
                <>
                  <button type="button" onClick={() => setEditing(c.id)} className="hover:text-ink-900">
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => tripId && mutate((token) => api.deleteComment(tripId, token, item.id, c.id))}
                    className="hover:text-rose-600"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl bg-ink-50 p-3">
      {roots.length > 0 && (
        <ul className="space-y-4">
          {roots.map((root) => {
            const replies = repliesOf(root.id);
            return (
              <li key={root.id} className="space-y-3">
                {row(root, root.id)}
                {(replies.length > 0 || replyTo === root.id) && (
                  <ul className="ml-3 space-y-3 border-l-2 border-ink-200 pl-4">
                    {replies.map((r) => (
                      <li key={r.id}>{row(r, root.id)}</li>
                    ))}
                    {replyTo === root.id && (
                      <li>
                        <CommentInput
                          autoFocus
                          placeholder={`${root.deleted ? "" : `${root.author}님에게 `}답글 달기`}
                          submitLabel="보내기"
                          onCancel={() => setReplyTo(null)}
                          onSubmit={async (text) => {
                            const ok = await add(text, root.id);
                            if (ok) setReplyTo(null);
                            return ok;
                          }}
                        />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <CommentInput
        placeholder={me ? `${me.nickname}(으)로 코멘트 남기기` : "참여 후 코멘트를 남길 수 있어요"}
        submitLabel="보내기"
        disabled={!me}
        onSubmit={(text) => add(text)}
      />
    </div>
  );
}
