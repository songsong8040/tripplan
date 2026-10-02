"use client";

import { AlertCircle, CheckCircle2 } from "@/components/ui/icons";

import { useToastStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto flex max-w-sm animate-fade-up items-start gap-2 rounded-3xl px-5 py-3 text-left text-sm font-medium shadow-lift",
            t.tone === "error" ? "bg-rose-100 text-rose-700" : "bg-ink-900 text-white"
          )}
        >
          {t.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="whitespace-pre-line">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
