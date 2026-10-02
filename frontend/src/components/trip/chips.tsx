"use client";

import * as React from "react";
import { Plus, X } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

/** 선택 가능한 둥근 칩 */
export function ChipToggle({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all active:scale-95",
        selected ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200",
        className
      )}
    >
      {children}
    </button>
  );
}

/** 단일/다중 선택 칩 그룹 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: readonly T[];
  value: T | T[];
  onChange: (value: T | T[]) => void;
  multiple?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <ChipToggle
          key={opt}
          selected={selected.includes(opt)}
          onClick={() => {
            if (!multiple) return onChange(opt);
            onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
          }}
        >
          {opt}
        </ChipToggle>
      ))}
    </div>
  );
}

/** 자유 입력 + 추천 칩으로 태그(알레르기/기피 음식 등)를 등록 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  tone = "default",
  max = 20,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  tone?: "default" | "danger" | "positive";
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").slice(0, 20);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  };

  const toneClass = {
    default: "bg-white text-ink-700 ring-1 ring-ink-200",
    danger: "bg-rose-100 text-rose-700",
    positive: "bg-mint-100 text-mint-700",
  }[tone];

  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-2.5">
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-transparent bg-ink-100 px-2 py-1.5 transition-colors focus-within:border-ink-900 focus-within:bg-white">
        {value.map((tag) => (
          <span key={tag} className={cn("inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-1.5 text-sm font-semibold", toneClass)}>
            {tag}
            <button
              type="button"
              aria-label={`${tag} 삭제`}
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-full p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) {
              add(v);
              setDraft("");
            } else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft) {
              add(draft);
              setDraft("");
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-ink-50 px-3 text-xs font-medium text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ALLERGY_SUGGESTIONS = ["갑각류", "견과류", "땅콩", "우유", "달걀", "밀", "대두", "생선", "복숭아", "메밀"];
export const DISLIKE_SUGGESTIONS = ["회/날것", "매운 음식", "고수", "내장류", "양고기", "오이", "해산물", "가지"];
export const PREFERENCE_SUGGESTIONS = ["고기", "해산물", "한식", "양식", "디저트", "비건", "술집", "뷰 맛집", "노포", "사진 명소"];
