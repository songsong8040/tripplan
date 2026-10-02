"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";

/** 새 여행 방을 만들고 이동하는 버튼 (둘러보기 페이지용) */
export function StartTripButton({ label, className, dark }: { label: string; className?: string; dark?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="lg"
      variant={dark ? "default" : "secondary"}
      className={cn("mt-2", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await api.createTrip();
          router.push(`/trip/${id}`);
        } catch (e) {
          toast.error((e as ApiError).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Plus />}
      {label}
    </Button>
  );
}
