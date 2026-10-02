"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { api, ApiError } from "@/lib/api";
import type { Trip } from "@/lib/types";

// ---------------------------------------------------------------------------
// 방별 참여 세션 (브라우저에 저장 → 링크 재방문 시 자동 입장)
// ---------------------------------------------------------------------------

interface Session {
  token: string;
  participantId: string;
  nickname: string;
}

interface SessionState {
  sessions: Record<string, Session>;
  setSession: (tripId: string, session: Session) => void;
  clearSession: (tripId: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: {},
      setSession: (tripId, session) => set((s) => ({ sessions: { ...s.sessions, [tripId]: session } })),
      clearSession: (tripId) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[tripId];
          return { sessions: next };
        }),
    }),
    { name: "tripplan-sessions", storage: createJSONStorage(() => localStorage) }
  )
);

// ---------------------------------------------------------------------------
// 공유 여행 계획 북마크 (로그인이 없어 이 기기에 저장)
// ---------------------------------------------------------------------------

interface BookmarkState {
  ids: string[];
  toggle: (id: string) => boolean;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const on = !get().ids.includes(id);
        set({ ids: on ? [id, ...get().ids] : get().ids.filter((x) => x !== id) });
        return on;
      },
    }),
    { name: "tripplan-bookmarks", storage: createJSONStorage(() => localStorage) }
  )
);

// ---------------------------------------------------------------------------
// 토스트
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  tone: "default" | "error";
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, tone = "default") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string) => useToastStore.getState().push(message);
toast.error = (message: string) => useToastStore.getState().push(message, "error");

// ---------------------------------------------------------------------------
// 현재 보고 있는 여행 방 상태
// ---------------------------------------------------------------------------

type Mutation = (token: string) => Promise<Trip>;

interface TripState {
  trip: Trip | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  load: (id: string) => Promise<void>;
  /** 서버 version 이 바뀌었으면 다시 불러온다 */
  sync: () => Promise<void>;
  /** 인증된 변경 요청을 실행하고 응답으로 상태를 교체한다 */
  mutate: (fn: Mutation, successMessage?: string) => Promise<boolean>;
  setTrip: (trip: Trip) => void;
}

export const useTripStore = create<TripState>()((set, get) => ({
  trip: null,
  loading: false,
  error: null,
  notFound: false,

  load: async (id) => {
    set({ loading: true, error: null, notFound: false });
    try {
      const trip = await api.getTrip(id);
      set({ trip, loading: false });
    } catch (e) {
      const err = e as ApiError;
      set({ loading: false, error: err.message, notFound: err.status === 404 });
    }
  },

  sync: async () => {
    const current = get().trip;
    if (!current) return;
    try {
      const { version } = await api.getVersion(current.id);
      if (version !== current.version) {
        const trip = await api.getTrip(current.id);
        // 응답 도착 전에 내 변경으로 더 최신이 되었으면 덮어쓰지 않는다
        if (trip.version >= (get().trip?.version ?? 0)) set({ trip });
      }
    } catch {
      // 폴링 실패는 조용히 무시 (다음 주기에 재시도)
    }
  },

  mutate: async (fn, successMessage) => {
    const trip = get().trip;
    if (!trip) return false;
    const session = useSessionStore.getState().sessions[trip.id];
    if (!session) {
      toast.error("먼저 닉네임과 PIN으로 참여해 주세요.");
      return false;
    }
    try {
      const next = await fn(session.token);
      set({ trip: next });
      if (successMessage) toast(successMessage);
      return true;
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) useSessionStore.getState().clearSession(trip.id);
      if (err.status === 409) void get().load(trip.id);
      toast.error(err.message);
      return false;
    }
  },

  setTrip: (trip) => set({ trip }),
}));
