import type {
  Drinking,
  ItemPatch,
  JoinResponse,
  Participant,
  PlaceSearchResult,
  RouteLegResult,
  Trip,
  TripSpec,
  VoteValue,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI 검증 오류
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`)
      .join("\n");
  }
  return "요청을 처리하지 못했어요.";
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Participant-Token": token } : {}),
        ...headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없어요. 백엔드가 실행 중인지 확인해 주세요.", 0);
  }
  if (!res.ok) {
    let message = "";
    const raw = await res.text().catch(() => "");
    try {
      message = formatDetail(JSON.parse(raw).detail);
    } catch {
      // JSON 이 아닌 응답: 프록시가 연결을 끊었거나(시간 초과·백엔드 재시작) 백엔드가 꺼진 경우
      if (res.status >= 500)
        message = `서버 응답이 끊겼어요 (${res.status}). 백엔드가 실행 중인지 확인하고 잠시 후 다시 시도해 주세요.`;
    }
    // 어떤 경우에도 빈 토스트가 뜨지 않게 한다
    if (!message.trim() || message.trim() === "-") message = `요청을 처리하지 못했어요 (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);

/** 참여자 취향 (음식 + 음주) */
export interface PreferencesBody {
  allergies: string[];
  dislikes: string[];
  preferred_tags: string[];
  drinking: Drinking | null;
  drink_types: string[];
}

export const api = {
  health: () => request<{ ok: boolean; gemini: boolean; kakao: boolean; model: string }>("/health"),
  route: (legs: { mode: "car" | "walk"; start: { lat: number; lng: number }; end: { lat: number; lng: number } }[]) =>
    request<(RouteLegResult | null)[]>("/route", { method: "POST", body: json({ legs }) }),
  searchPlaces: (q: string, region: string) =>
    request<PlaceSearchResult[]>(`/places/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}`),
  locate: (id: string, token: string) => request<Trip>(`/trips/${id}/locate`, { method: "POST", token }),
  replaceUnverified: (id: string, token: string) =>
    request<Trip>(`/trips/${id}/replace-unverified`, { method: "POST", token }),
  createTrip: () => request<{ id: string }>("/trips", { method: "POST" }),
  getTrip: (id: string) => request<Trip>(`/trips/${id}`),
  getVersion: (id: string) => request<{ version: number }>(`/trips/${id}/version`),

  join: (
    id: string,
    body: { nickname: string; pin: string } & PreferencesBody
  ) => request<JoinResponse>(`/trips/${id}/join`, { method: "POST", body: json(body) }),
  me: (id: string, token: string) => request<Participant>(`/trips/${id}/me`, { token }),
  updatePreferences: (
    id: string,
    token: string,
    body: PreferencesBody
  ) => request<Trip>(`/trips/${id}/me/preferences`, { method: "PUT", token, body: json(body) }),

  updateSpec: (id: string, token: string, spec: TripSpec) =>
    request<Trip>(`/trips/${id}/spec`, { method: "PUT", token, body: json(spec) }),
  generate: (id: string, token: string) => request<Trip>(`/trips/${id}/generate`, { method: "POST", token }),

  addItem: (
    id: string,
    token: string,
    planId: string,
    day: number,
    body: { name: string; category: string; start_time: string; duration_minutes: number; memo: string }
  ) => request<Trip>(`/trips/${id}/plans/${planId}/days/${day}/items`, { method: "POST", token, body: json(body) }),
  patchItem: (id: string, token: string, itemId: string, patch: ItemPatch) =>
    request<Trip>(`/trips/${id}/items/${itemId}`, { method: "PATCH", token, body: json(patch) }),
  deleteItem: (id: string, token: string, itemId: string) =>
    request<Trip>(`/trips/${id}/items/${itemId}`, { method: "DELETE", token }),
  reorder: (id: string, token: string, planId: string, day: number, itemIds: string[]) =>
    request<Trip>(`/trips/${id}/plans/${planId}/days/${day}/order`, {
      method: "PUT",
      token,
      body: json({ item_ids: itemIds }),
    }),

  /** 일정 확정 (planId=null 이면 확정 취소) */
  confirmPlan: (id: string, token: string, planId: string | null) =>
    request<Trip>(`/trips/${id}/confirm`, { method: "PUT", token, body: json({ plan_id: planId }) }),
  vote: (id: string, token: string, itemId: string, value: VoteValue | null) =>
    request<Trip>(`/trips/${id}/items/${itemId}/vote`, { method: "PUT", token, body: json({ value }) }),
  addComment: (id: string, token: string, itemId: string, text: string, parentId?: string) =>
    request<Trip>(`/trips/${id}/items/${itemId}/comments`, {
      method: "POST",
      token,
      body: json({ text, parent_id: parentId ?? null }),
    }),
  editComment: (id: string, token: string, itemId: string, commentId: string, text: string) =>
    request<Trip>(`/trips/${id}/items/${itemId}/comments/${commentId}`, { method: "PATCH", token, body: json({ text }) }),
  deleteComment: (id: string, token: string, itemId: string, commentId: string) =>
    request<Trip>(`/trips/${id}/items/${itemId}/comments/${commentId}`, { method: "DELETE", token }),
};
