# TripPlan — AI 협업 여행 플래너

로그인 없이 링크로 모여 Gemini가 추천한 여행 일정(1안/2안)을 함께 조율·공유하는 웹 앱.

```
tripplan/
├─ frontend/   Next.js 15 (App Router) · TypeScript · Tailwind v3 · shadcn/ui · Zustand · React Hook Form
└─ backend/    FastAPI · Pydantic v2 · google-genai (gemini-2.5-flash, Structured Output) · SQLite
```

## 실행

### PyCharm (권장)

상단 실행 구성 드롭다운에서 선택 후 ▶:

| 구성 | 내용 |
|---|---|
| **TripPlan (All)** | 아래 두 개를 동시에 실행 → http://localhost:3100 |
| Backend (FastAPI) | 프로젝트 인터프리터(conda `tripplan`)로 `uvicorn app.main:app --reload --port 8100` |
| Frontend (Next.js) | `npm run dev -- -p 3100` (`API_ORIGIN=http://127.0.0.1:8100`) |

> 이 PC에서 3000/8000 포트를 다른 프로젝트가 쓰고 있어 3100/8100을 사용합니다.
> Gemini 키는 `backend/.env`의 `GEMINI_API_KEY`에 입력하세요.
> (선택) `KAKAO_REST_API_KEY`를 넣으면 AI가 추천한 장소를 카카오 로컬 API로 실존 검증하고, 지도 버튼이 카카오 장소 페이지로 바로 연결됩니다.

### 터미널에서 직접

#### 1) 백엔드 (포트 8000)

```bash
cd backend
python -m venv .venv            # Miniconda python 사용 가능
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # GEMINI_API_KEY 입력 (https://aistudio.google.com/apikey)
uvicorn app.main:app --reload --port 8000
```

`GEMINI_API_KEY`가 비어 있으면 `[예시]` 목업 일정이 생성됩니다(`ALLOW_MOCK_FALLBACK=1`).

#### 2) 프론트엔드 (포트 3000)

```bash
cd frontend
npm install
npm run dev
```

브라우저는 `/api/*`로 호출하고 Next가 백엔드로 프록시합니다. 백엔드 주소가 다르면 `API_ORIGIN=http://127.0.0.1:8100 npm run dev`.

## 구현 범위 (vibe-coding-prompt.md Phase 1~5)

| Phase | 내용 | 주요 파일 |
|---|---|---|
| 1 | 디자인 토큰(뉴트럴 팔레트, rounded-2xl/3xl), shadcn/ui 컴포넌트, 반응형 Shell | `tailwind.config.ts`, `src/components/ui/*`, `src/components/layout/Shell.tsx` |
| 2 | UUID 방 생성, 닉네임+6자리 PIN 참여, 알레르기/기피/선호 칩, 여행 조건 폼(기간·달력·인원·성별/연령·테마) | `src/components/trip/JoinDialog.tsx`, `TripSpecForm.tsx` |
| 3 | `TravelRequest`/`TripPlanResponse` 스키마, `response_schema` 기반 Structured Output, `/api/generate-plan` | `backend/app/schemas.py`, `planner.py`, `main.py` |
| 4 | 1안/2안 탭, 일정 카드(영업시간·브레이크·영업 상태 배지), 카카오/네이버/구글 지도, 캐치테이블/네이버 예약, 좋아요/싫어요(닉네임 툴팁), 코멘트, 수정 이력, 드래그 앤 드롭, 추가/수정/삭제 | `src/components/plan/*` |
| 5 | Embla 슬라이드(카드뉴스) 뷰, xlsx 엑셀 다운로드(1안/2안 시트, 지도 하이퍼링크) | `SlideView.tsx`, `src/lib/exportXlsx.ts` |

### 설계 메모
- **실시간 협업**: 4초 간격 `version` 폴링(탭이 보일 때만). 변경 시에만 전체 상태를 다시 받습니다.
- **인증**: PIN은 PBKDF2 해시로 저장, 참여 시 발급한 토큰(`X-Participant-Token`)으로 변경 요청을 검증. PIN 5회 오류 시 5분 잠금.
- **영업 상태 배지**: AI가 준 영업시간/브레이크/휴무 요일을 "방문 예정 시각·날짜" 기준으로 프론트에서 계산.
- **Gemini 응답 스키마**: 1안/2안을 `main_plan`/`alternative_plan` 필드로 강제해 항상 두 플랜이 오도록 함.

## 주요 API

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/trips` | 방 생성 |
| GET | `/api/trips/{id}` · `/version` | 상태 조회 · 폴링 |
| POST | `/api/trips/{id}/join` | 닉네임+PIN 참여/재입장 |
| PUT | `/api/trips/{id}/spec` | 여행 조건 저장 |
| POST | `/api/trips/{id}/generate` | 방 조건+참여자 취향으로 AI 플랜 생성·저장 |
| POST | `/api/generate-plan` | `TravelRequest` → `TripPlanResponse` (상태 없음) |
| POST/PATCH/DELETE | `/api/trips/{id}/.../items` | 일정 추가/수정/삭제 |
| PUT | `/api/trips/{id}/plans/{plan}/days/{day}/order` | 순서 변경 |
| PUT/POST | `/api/trips/{id}/items/{item}/vote` · `/comments` | 투표 · 코멘트 |
