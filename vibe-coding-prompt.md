# AI Collaborative Trip Planner - Vibe Coding Master Prompt (Gemini Free Tier)

## 1. Project Overview & Tech Stack
당신은 풀스택 시니어 소프트웨어 엔지니어 겸 프로덕트 디자이너입니다. 사용자가 로그인 없이 링크 기반으로 협업하며 AI 추천 여행 계획을 생성, 조율, 공유하는 모던 웹 애플리케이션을 개발합니다.

### Tech Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide React
- **UI Components**: shadcn/ui (Tailwind config 및 CSS 변수 기반 컴포넌트, 인라인 CSS 및 별도 CSS 파일 작성 금지)
- **Backend**: Python FastAPI, Pydantic v2, Uvicorn
- **AI / LLM**: Google Gemini API (Free Tier, 최신 `google-genai` SDK 사용, Pydantic 기반 Structured Output 강제)
- **Design System**: 최신 모바일/웹 트렌드 반영 (둥근 라운딩 `rounded-2xl/3xl`, 넉넉한 여백, 소프트 뉴트럴 톤의 모던 미니멀 UI, 완전 반응형)

---

## 2. Core Functional Requirements

### 1) 무로그인 방 생성 및 공유 세션 (UUID 기반)
- 회원가입/로그인 없이 '새 여행 만들기' 클릭 시 고유 UUID 방 생성.
- 링크로 접속한 유저는 닉네임과 6자리 간이 PIN 번호만 입력하고 참여(프로필 생성).
- 타임스탬프 기반 활동 로깅 (누가 언제 어떤 일정을 추가/수정/삭제했는지 표시).

### 2) 여행 조건 및 그룹 피드백 수집 (온보딩/설정)
- **인원 및 구성**: 총 인원수(미정 옵션 포함), 성별/연령대 구성비.
- **일정**: 대략적인 기간(예: 2박 3일) 또는 구체적인 일시/시간 입력 지원.
- **개인별 선호도 수집**: 참여자별 알레르기 식재료, 기피 음식, 선호 태그.
- **여행 테마 멀티 셀렉트**: 힐링, 맛집 투어, 야외 액티비티, 실내 문화/전시, 쇼핑, 호캉스 등.

### 3) Gemini 연동 AI 여행 플래너 엔진
- FastAPI 백엔드에서 `google-genai` SDK를 사용해 `gemini-2.5-flash` 모델 호출.
- `response_mime_type="application/json"` 및 `response_schema=TripPlanResponse`로 완벽한 타입 안전 JSON 보장.
- **멀티 시나리오 생성**: 메인 플랜(1안), 여유/대체 플랜(2안) 동시 반환.
- **일정 세부 정보 스펙**:
  - 장소명, 카테고리, 체류 시간, 간단한 추천 사유.
  - 영업시간 및 브레이크 타임, 영업 상태 배지.
  - 지도 외부 링크 버튼 (카카오맵, 네이버지도, 구글 지도 딥링크 지원).
  - 식당/카페의 경우 캐치테이블/네이버 예약 바로가기 링크 지원.

### 4) 실시간 협업 및 커스텀 기능
- 일정 카드별 드래그 앤 드롭 순서 변경 및 커스텀 추가/삭제.
- 장소별 좋아요/싫어요 투표 및 닉네임 코멘트 스레드.
- 일정 수정 시 누가 언제 수정했는지 이력 뱃지 노출.

### 5) 뷰 모드 및 내보내기 (Export)
- **타임라인/리스트 뷰**: 인터랙티브 일정표.
- **슬라이드 뷰**: 전체 화면/모달에서 카드 뉴스 형태로 넘겨보는 프레젠테이션 뷰.
- **엑셀(XLSX) 다운로드**: 일자/시간/장소/메모/지도링크가 정돈된 엑셀 파일 출력.

---

## 3. Step-by-Step Implementation Prompts

한 번에 모든 코드를 작성하지 말고, 아래 단계에 맞춰 순서대로 개발을 진행하세요.

---

### Phase 1: 프로젝트 기초 설정 및 디자인 시스템 구축
"Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui 기반의 프로젝트를 셋업해주세요.
- tailwind.config.ts에 부드러운 둥근 모서리(`rounded-2xl`, `rounded-3xl`)와 모던한 뉴트럴 컬러 팔레트를 정의하세요.
- shadcn/ui 기본 컴포넌트(Button, Card, Dialog, Input, Badge, Tabs, DropdownMenu 등)를 추가해주세요.
- 모바일과 데스크톱 모두에서 여백이 최적화된 반응형 레이아웃 셸(`components/layout/Shell.tsx`)을 만드세요."

---

### Phase 2: 무로그인 온보딩 및 여행 스펙 입력 폼
"여행을 처음 생성하거나 수정할 수 있는 반응형 폼 컴포넌트를 작성해주세요.
- 필수 입력 필드: 여행 지역, 대략적 기간 또는 구체적 날짜/시간 선택(Calendar), 여행 인원(확정/미정 토글, 성별/연령대 칩).
- 여행 테마 선택 카드(아이콘 포함, 다중 선택 가능: 힐링, 맛집, 실외/실내 액티비티 등).
- 각 참여자가 닉네임과 간이 비밀번호(6자리)를 입력하고 자신의 알레르기/비선호 음식을 칩(Badge) 형태로 등록할 수 있는 모달 UI를 구현해주세요.
- 프론트엔드 상태 관리는 Zustand 또는 React Hook Form을 사용하세요."

---

### Phase 3: FastAPI 백엔드 & Google Gemini Structured Output 연동
"Python FastAPI 백엔드에서 Google Gemini API(Free Tier)를 호출하는 구조를 만들어주세요.
- `google-genai` 패키지를 설치하고 `GEMINI_API_KEY` 환경변수를 로드하는 클라이언트를 설정하세요.
- Pydantic v2 모델로 여행 입력 데이터(TravelRequest)와 결과 스키마(TripPlanResponse)를 엄격히 정의하세요.
  - 결과 스키마 필드: 1안/2안 플랜 목록, 일자(Day 1, 2...), 장소명, 카테고리, 예상 시간, 영업시간, 브레이크타임, 검색 키워드 등.
- `client.models.generate_content`를 호출할 때 `model='gemini-2.5-flash'`, `response_mime_type='application/json'`, `response_schema=TripPlanResponse` 옵션을 설정해 마크다운 파싱 없이 바로 Pydantic 검증된 JSON을 반환하도록 엔드포인트 `/api/generate-plan`을 구현하세요."

---

### Phase 4: 여행 계획 카드 UI, 지도/예약 링크 및 투표 시스템
"Next.js 프론트엔드에서 생성된 여행 계획을 표시하는 UI를 구현해주세요.
- 상단에서 1안/2안을 탭(`Tabs`)으로 전환할 수 있게 만드세요.
- 일정 카드 컴포넌트:
  - 장소명, 시간, 추천 이유, 영업시간/브레이크타임 뱃지.
  - 지도 연결 액션 버튼: 카카오맵, 네이버지도, 구글 지도 딥링크(`https://map.kakao.com/link/search/{place}` 등).
  - 식당일 경우 캐치테이블 검색 바로가기 버튼(`https://app.catchtable.co.kr/ct/search/total?query={place}`).
  - 좋아요/싫어요 토글 버튼 및 투표한 사람의 닉네임 툴팁 표시.
  - 일정 수정 내역(예: '민수님이 14:20에 시간 변경')을 보여주는 히스토리 라벨."

---

### Phase 5: 슬라이드 뷰 모드 및 엑셀 다운로드 (Export)
"완성된 여행 일정을 외부로 공유하고 소비하기 위한 기능을 구현해주세요.
- **슬라이드 뷰 모드**: Swiper나 Embla Carousel을 활용해 Day별/장소별 일정을 카드 뉴스 형태의 전체 화면 슬라이드로 넘겨보는 뷰를 제작하세요.
- **엑셀 다운로드**: `xlsx` 라이브러리를 사용하여 일자, 시간, 장소, 카테고리, 메모, 지도 링크가 깔끔한 테이블 스타일로 정리된 엑셀 파일로 다운로드되는 기능을 클라이언트 사이드에서 구현해주세요."