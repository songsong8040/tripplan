"use client";

import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "@/components/ui/icons";
import { SORTS } from "@/lib/explore";

/** 정렬 셀렉트 (주소의 ?sort= 로 유지, 검색어 q 도 함께 유지) */
export function SortSelect({
  basePath,
  active,
  query,
  area,
}: {
  basePath: string;
  active?: string;
  query?: string;
  area?: string;
}) {
  const current = SORTS.find((s) => s.key === active) ?? SORTS[0];
  const href = (sort: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (area && area !== "all") params.set("area", area);
    if (sort !== "popular") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`정렬: ${current.label}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-100 data-[state=open]:bg-ink-100"
        >
          {current.label}
          <ChevronDown className="h-2.5 w-2.5 text-ink-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.key} asChild>
            <Link href={href(s.key)} scroll={false} className="justify-between">
              <span className={s.key === current.key ? "font-bold text-ink-900" : "text-ink-600"}>{s.label}</span>
              {s.key === current.key && <Check className="h-3 w-3" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
