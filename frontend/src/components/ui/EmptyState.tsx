import * as React from "react";

import { cn } from "@/lib/utils";

/** 빈 화면 공통: 파스텔 원 아이콘 + 제목 + 설명 + 버튼 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-5 rounded-[2rem] bg-ink-50 px-6 py-14 text-center", className)}>
      <div className="relative">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-soft">
          <Icon className="h-6 w-6 text-ink-700" />
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-bold tracking-tight">{title}</p>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}
