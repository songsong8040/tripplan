"use client";

import { Avatar } from "@/components/trip/people";
import { clockTime, timeAgo } from "@/lib/format";
import type { ActivityLog, Participant } from "@/lib/types";

export function ActivityFeed({ activity, participants }: { activity: ActivityLog[]; participants: Participant[] }) {
  const byName = new Map(participants.map((p) => [p.nickname, p]));
  const items = [...activity].reverse();

  if (!items.length) {
    return <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-sm text-muted-foreground">아직 활동이 없어요.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {items.map((log) => {
        const person = byName.get(log.actor) ?? { nickname: log.actor, color: "#a8a39a" };
        return (
          <li key={log.id} className="relative flex gap-3">
            <Avatar person={person} />
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm">
                <span className="font-semibold">{log.actor}</span>님이 {log.action}
              </p>
              {log.target && <p className="truncate text-xs text-muted-foreground">{log.target}</p>}
              <time dateTime={log.at} title={clockTime(log.at)} className="text-[0.6875rem] text-muted-foreground/80">
                {timeAgo(log.at)} · {clockTime(log.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
