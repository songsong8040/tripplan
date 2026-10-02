/**
 * 둘러보기(공유된 여행 계획) 목데이터
 * 실제 서비스에서는 백엔드의 공개 여행 계획 API 로 대체한다.
 * 대표 이미지는 위키미디어 공용(Wikimedia Commons) 사진을 public/explore 에 내려받아 사용한다.
 */
import type { Category } from "@/lib/types";

export interface Region {
  key: string;
  name: string;
  /** 국가 (국내는 "대한민국") */
  country: string;
  overseas: boolean;
  /** 국기 이모지 (작은 포인트) */
  flag: string;
  /** 누적 계획 수 (인기 순 정렬용) */
  planCount: number;
  image: string;
  tagline: string;
}

export interface SharedPlace {
  time: string;
  name: string;
  category: Category;
  note?: string;
}

export interface SharedPlan {
  id: string;
  regionKey: string;
  title: string;
  author: string;
  nights: number;
  days: number;
  people: number;
  transport: "대중교통" | "자차" | "도보 위주";
  /** 대략 언제 다녀온 여행인지 (예: "2025년 10월") */
  travelMonth: string;
  /** 1인 경비 (대략) */
  budget: string;
  /** 작성자가 남긴 팁 */
  tips: string[];
  tags: string[];
  likes: number;
  summary: string;
  itinerary: { day: number; title: string; places: SharedPlace[] }[];
}

export const REGIONS: Region[] = [
  {
    key: "jeju",
    name: "제주",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 128,
    tagline: "오름과 바다, 귤밭 사이로",
    image: "/explore/jeju.jpg",
  },
  {
    key: "busan",
    name: "부산",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 96,
    tagline: "바다 보며 먹고 걷는 도시",
    image: "/explore/busan.jpg",
  },
  {
    key: "gangneung",
    name: "강릉",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 74,
    tagline: "커피 거리와 동해 일출",
    image: "/explore/gangneung.jpg",
  },
  {
    key: "gyeongju",
    name: "경주",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 61,
    tagline: "천년 고도의 밤 산책",
    image: "/explore/gyeongju.jpg",
  },
  {
    key: "seoul",
    name: "서울",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 58,
    tagline: "궁궐부터 성수까지",
    image: "/explore/seoul.jpg",
  },
  {
    key: "jeonju",
    name: "전주",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 43,
    tagline: "한옥마을 골목 미식 여행",
    image: "/explore/jeonju.jpg",
  },
  {
    key: "sokcho",
    name: "속초",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 39,
    tagline: "설악산과 바다를 한 번에",
    image: "/explore/sokcho.jpg",
  },
  {
    key: "tongyeong",
    name: "통영",
    country: "대한민국",
    overseas: false,
    flag: "🇰🇷",
    planCount: 27,
    tagline: "남해의 작은 섬들",
    image: "/explore/tongyeong.jpg",
  },
  {
    key: "tokyo",
    name: "도쿄",
    country: "일본",
    overseas: true,
    flag: "🇯🇵",
    planCount: 142,
    tagline: "시부야부터 오다이바까지",
    image: "/explore/tokyo.jpg",
  },
  {
    key: "osaka",
    name: "오사카",
    country: "일본",
    overseas: true,
    flag: "🇯🇵",
    planCount: 118,
    tagline: "먹다 지치는 미식 도시",
    image: "/explore/osaka.jpg",
  },
  {
    key: "fukuoka",
    name: "후쿠오카",
    country: "일본",
    overseas: true,
    flag: "🇯🇵",
    planCount: 88,
    tagline: "가깝고 가볍게 떠나는 주말",
    image: "/explore/fukuoka.jpg",
  },
  {
    key: "taipei",
    name: "타이베이",
    country: "대만",
    overseas: true,
    flag: "🇹🇼",
    planCount: 76,
    tagline: "야시장과 지우펀 골목",
    image: "/explore/taipei.jpg",
  },
  {
    key: "danang",
    name: "다낭",
    country: "베트남",
    overseas: true,
    flag: "🇻🇳",
    planCount: 69,
    tagline: "리조트와 바다, 호이안 야경",
    image: "/explore/danang.jpg",
  },
  {
    key: "bangkok",
    name: "방콕",
    country: "태국",
    overseas: true,
    flag: "🇹🇭",
    planCount: 54,
    tagline: "사원, 마사지, 루프탑",
    image: "/explore/bangkok.jpg",
  },
  {
    key: "paris",
    name: "파리",
    country: "프랑스",
    overseas: true,
    flag: "🇫🇷",
    planCount: 41,
    tagline: "미술관과 센강 산책",
    image: "/explore/paris.jpg",
  },
  {
    key: "hawaii",
    name: "하와이",
    country: "미국",
    overseas: true,
    flag: "🇺🇸",
    planCount: 37,
    tagline: "와이키키의 느린 하루",
    image: "/explore/hawaii.jpg",
  },
];

export const SHARED_PLANS: SharedPlan[] = [
  {
    id: "jeju-east-healing",
    regionKey: "jeju",
    title: "제주 동쪽 오름 & 바다 힐링",
    author: "민지",
    nights: 2,
    days: 3,
    people: 2,
    transport: "자차",
    travelMonth: "2025년 10월",
    budget: "35만 원",
    tips: ["성산일출봉은 일출 1시간 전부터 주차가 꽉 차요.", "우도는 전기차 대여보다 자전거가 더 재밌어요."],
    tags: ["힐링", "자연 경관", "카페 투어"],
    likes: 342,
    summary: "성산·구좌 쪽으로 동선을 묶어 운전은 짧게, 바다 뷰 카페와 오름을 여유 있게 즐기는 코스예요.",
    itinerary: [
      {
        day: 1,
        title: "성산 일출과 우도",
        places: [
          { time: "06:00", name: "성산일출봉", category: "관광지", note: "일출 보려면 30분 전 도착" },
          { time: "09:00", name: "성산 해녀의집", category: "식당", note: "전복죽 아침" },
          { time: "10:30", name: "우도", category: "관광지" },
          { time: "16:00", name: "광치기해변", category: "관광지" },
        ],
      },
      {
        day: 2,
        title: "구좌 카페와 비자림",
        places: [
          { time: "10:00", name: "비자림", category: "휴식" },
          { time: "12:30", name: "세화해변", category: "관광지" },
          { time: "14:00", name: "월정리 해변 카페거리", category: "카페" },
          { time: "18:00", name: "동문재래시장", category: "식당" },
        ],
      },
      {
        day: 3,
        title: "오름 한 곳 오르고 공항으로",
        places: [
          { time: "09:00", name: "다랑쉬오름", category: "액티비티" },
          { time: "12:00", name: "함덕해수욕장", category: "관광지" },
        ],
      },
    ],
  },
  {
    id: "jeju-food-tour",
    regionKey: "jeju",
    title: "흑돼지부터 고기국수까지, 제주 먹방",
    author: "현우",
    nights: 1,
    days: 2,
    people: 4,
    transport: "자차",
    travelMonth: "2025년 12월",
    budget: "30만 원",
    tips: ["흑돼지는 저녁 7시 전에 가야 웨이팅이 짧아요."],
    tags: ["맛집 투어", "야경/나이트라이프"],
    likes: 251,
    summary: "제주시 위주로 맛집만 촘촘하게. 밤에는 탑동 바다 산책으로 마무리해요.",
    itinerary: [
      {
        day: 1,
        title: "제주시 먹방",
        places: [
          { time: "11:30", name: "자매국수", category: "식당" },
          { time: "14:00", name: "용두암", category: "관광지" },
          { time: "18:30", name: "돈사돈 본점", category: "식당" },
          { time: "21:00", name: "탑동 해변공연장", category: "관광지" },
        ],
      },
      {
        day: 2,
        title: "애월 바다 카페",
        places: [
          { time: "10:30", name: "애월 한담해안산책로", category: "휴식" },
          { time: "12:30", name: "애월 카페거리", category: "카페" },
        ],
      },
    ],
  },
  {
    id: "jeju-family",
    regionKey: "jeju",
    title: "아이와 함께 서귀포 3박 4일",
    author: "소윤맘",
    nights: 3,
    days: 4,
    people: 4,
    transport: "자차",
    travelMonth: "2025년 7월",
    budget: "80만 원",
    tips: ["아이와 함께라면 하루 3곳 이하가 딱 좋아요.", "카멜리아힐은 유모차 이동이 편해요."],
    tags: ["야외 액티비티", "호캉스"],
    likes: 188,
    summary: "하루 3곳 이하로 느긋하게. 숙소 수영장과 체험 위주라 아이도 지치지 않아요.",
    itinerary: [
      { day: 1, title: "중문 도착", places: [{ time: "15:00", name: "중문색달해수욕장", category: "관광지" }, { time: "18:00", name: "중문 흑돼지 거리", category: "식당" }] },
      { day: 2, title: "체험 데이", places: [{ time: "10:00", name: "카멜리아힐", category: "관광지" }, { time: "14:00", name: "제주 감귤따기 체험", category: "액티비티" }] },
      { day: 3, title: "폭포와 올레시장", places: [{ time: "10:00", name: "정방폭포", category: "관광지" }, { time: "12:30", name: "서귀포매일올레시장", category: "식당" }] },
      { day: 4, title: "천천히 공항으로", places: [{ time: "10:00", name: "산방산", category: "관광지" }] },
    ],
  },
  {
    id: "busan-sea-night",
    regionKey: "busan",
    title: "해운대·광안리 바다와 야경",
    author: "지수",
    nights: 1,
    days: 2,
    people: 3,
    transport: "대중교통",
    travelMonth: "2025년 8월",
    budget: "20만 원",
    tips: ["해변열차는 미리 예약하면 기다리지 않아요.", "광안대교 불빛쇼는 매일 저녁 8시·9시예요."],
    tags: ["야경/나이트라이프", "맛집 투어"],
    likes: 296,
    summary: "지하철로만 다니는 뚜벅이 코스. 블루라인파크 해변열차로 바다를 따라 이동해요.",
    itinerary: [
      {
        day: 1,
        title: "해운대에서 광안리까지",
        places: [
          { time: "11:00", name: "해운대 블루라인파크", category: "액티비티" },
          { time: "13:00", name: "청사포 조개구이", category: "식당" },
          { time: "16:00", name: "해운대해수욕장", category: "관광지" },
          { time: "20:00", name: "광안리 해수욕장", category: "관광지", note: "광안대교 야경" },
        ],
      },
      {
        day: 2,
        title: "원도심 골목",
        places: [
          { time: "10:30", name: "감천문화마을", category: "문화/전시" },
          { time: "13:00", name: "자갈치시장", category: "식당" },
          { time: "15:00", name: "BIFF광장", category: "쇼핑" },
        ],
      },
    ],
  },
  {
    id: "busan-cafe",
    regionKey: "busan",
    title: "영도 & 기장 오션뷰 카페 투어",
    author: "하은",
    nights: 1,
    days: 2,
    people: 2,
    transport: "자차",
    travelMonth: "2026년 3월",
    budget: "25만 원",
    tips: ["영도 카페는 주차 공간이 좁아 대중교통을 추천해요."],
    tags: ["카페 투어", "힐링"],
    likes: 164,
    summary: "바다가 통창으로 보이는 카페만 골라 다니는 여유로운 일정이에요.",
    itinerary: [
      { day: 1, title: "영도 흰여울", places: [{ time: "11:00", name: "흰여울문화마을", category: "관광지" }, { time: "13:00", name: "영도 해안 카페", category: "카페" }] },
      { day: 2, title: "기장 해안", places: [{ time: "10:00", name: "해동용궁사", category: "관광지" }, { time: "12:30", name: "기장 대변항", category: "식당" }] },
    ],
  },
  {
    id: "gangneung-coffee",
    regionKey: "gangneung",
    title: "강릉 커피거리 당일치기",
    author: "도윤",
    nights: 0,
    days: 1,
    people: 2,
    transport: "대중교통",
    travelMonth: "2026년 1월",
    budget: "7만 원",
    tips: ["KTX 강릉역에서 안목해변까지 버스로 25분이에요."],
    tags: ["카페 투어", "힐링"],
    likes: 211,
    summary: "KTX 타고 와서 안목해변 커피거리와 경포호를 걷는 가벼운 하루 코스예요.",
    itinerary: [
      {
        day: 1,
        title: "바다와 커피",
        places: [
          { time: "10:30", name: "안목해변 커피거리", category: "카페" },
          { time: "12:30", name: "초당순두부마을", category: "식당" },
          { time: "14:30", name: "경포대", category: "관광지" },
          { time: "16:30", name: "경포호 산책로", category: "휴식" },
        ],
      },
    ],
  },
  {
    id: "gangneung-sunrise",
    regionKey: "gangneung",
    title: "정동진 일출과 강릉 시장 먹방",
    author: "태민",
    nights: 1,
    days: 2,
    people: 4,
    transport: "자차",
    travelMonth: "2026년 1월",
    budget: "18만 원",
    tips: ["정동진 일출 시간은 계절마다 달라요. 전날 꼭 확인!"],
    tags: ["자연 경관", "맛집 투어"],
    likes: 133,
    summary: "새벽 정동진 일출로 시작해 중앙시장 먹거리로 마무리하는 코스예요.",
    itinerary: [
      { day: 1, title: "시장과 바다", places: [{ time: "13:00", name: "강릉중앙시장", category: "식당" }, { time: "16:00", name: "주문진수산시장", category: "식당" }] },
      { day: 2, title: "정동진 일출", places: [{ time: "05:30", name: "정동진", category: "관광지" }, { time: "09:00", name: "하슬라아트월드", category: "문화/전시" }] },
    ],
  },
  {
    id: "gyeongju-night",
    regionKey: "gyeongju",
    title: "경주 황리단길 & 야경 산책",
    author: "서연",
    nights: 1,
    days: 2,
    people: 2,
    transport: "도보 위주",
    travelMonth: "2025년 11월",
    budget: "16만 원",
    tips: ["동궁과 월지는 해 지기 직전에 들어가야 노을과 야경을 다 봐요."],
    tags: ["역사 탐방", "야경/나이트라이프"],
    likes: 245,
    summary: "황리단길에 숙소를 잡고 걸어서 다니는 코스. 동궁과 월지 야경은 꼭 보세요.",
    itinerary: [
      {
        day: 1,
        title: "황리단길과 대릉원",
        places: [
          { time: "12:00", name: "황리단길", category: "쇼핑" },
          { time: "15:00", name: "대릉원", category: "관광지" },
          { time: "17:30", name: "첨성대", category: "관광지" },
          { time: "19:30", name: "동궁과 월지", category: "관광지", note: "야경 명소" },
        ],
      },
      { day: 2, title: "불국사", places: [{ time: "10:00", name: "불국사", category: "관광지" }, { time: "13:00", name: "경주 쌈밥거리", category: "식당" }] },
    ],
  },
  {
    id: "seoul-palace",
    regionKey: "seoul",
    title: "서울 궁궐 산책과 성수 카페",
    author: "준호",
    nights: 0,
    days: 1,
    people: 2,
    transport: "대중교통",
    travelMonth: "2026년 4월",
    budget: "6만 원",
    tips: ["한복을 입으면 경복궁 입장이 무료예요."],
    tags: ["역사 탐방", "카페 투어"],
    likes: 158,
    summary: "오전엔 경복궁과 북촌, 오후엔 지하철로 성수동 카페 골목까지.",
    itinerary: [
      {
        day: 1,
        title: "궁궐에서 성수까지",
        places: [
          { time: "10:00", name: "경복궁", category: "관광지" },
          { time: "12:30", name: "토속촌 삼계탕", category: "식당" },
          { time: "14:00", name: "북촌한옥마을", category: "관광지" },
          { time: "17:00", name: "성수동 카페거리", category: "카페" },
        ],
      },
    ],
  },
  {
    id: "jeonju-hanok",
    regionKey: "jeonju",
    title: "전주 한옥마을 한복 데이트",
    author: "유나",
    nights: 1,
    days: 2,
    people: 2,
    transport: "도보 위주",
    travelMonth: "2025년 9월",
    budget: "15만 원",
    tips: ["남부시장 야시장은 금·토 저녁에만 열려요."],
    tags: ["역사 탐방", "맛집 투어"],
    likes: 176,
    summary: "한복 대여하고 한옥마을 골목을 걷다가 남부시장 야시장으로!",
    itinerary: [
      { day: 1, title: "한옥마을", places: [{ time: "11:00", name: "전주한옥마을", category: "관광지" }, { time: "13:00", name: "전주 비빔밥", category: "식당" }, { time: "15:00", name: "경기전", category: "관광지" }, { time: "19:00", name: "남부시장 야시장", category: "식당" }] },
      { day: 2, title: "오목대 산책", places: [{ time: "10:00", name: "오목대", category: "휴식" }, { time: "12:00", name: "전주 콩나물국밥", category: "식당" }] },
    ],
  },
  {
    id: "sokcho-seorak",
    regionKey: "sokcho",
    title: "설악산 케이블카 & 속초 중앙시장",
    author: "민준",
    nights: 1,
    days: 2,
    people: 3,
    transport: "자차",
    travelMonth: "2025년 10월",
    budget: "17만 원",
    tips: ["케이블카는 현장 대기가 길어 오전 일찍 가세요."],
    tags: ["자연 경관", "맛집 투어"],
    likes: 142,
    summary: "설악산 권금성 케이블카로 가볍게 산을 보고 바다 앞 시장에서 먹방해요.",
    itinerary: [
      { day: 1, title: "설악산", places: [{ time: "10:00", name: "설악산 케이블카", category: "액티비티" }, { time: "13:00", name: "설악동 산채비빔밥", category: "식당" }] },
      { day: 2, title: "바다와 시장", places: [{ time: "10:00", name: "영금정", category: "관광지" }, { time: "12:00", name: "속초관광수산시장", category: "식당" }, { time: "14:00", name: "속초 엑스포타워", category: "관광지" }] },
    ],
  },
  {
    id: "tongyeong-island",
    regionKey: "tongyeong",
    title: "통영 루지 & 섬 여행",
    author: "가은",
    nights: 1,
    days: 2,
    people: 4,
    transport: "자차",
    travelMonth: "2026년 5월",
    budget: "22만 원",
    tips: ["소매물도 배편은 날씨에 따라 결항될 수 있어요."],
    tags: ["야외 액티비티", "자연 경관"],
    likes: 98,
    summary: "루지와 케이블카로 신나게, 다음 날은 배 타고 섬으로 떠나요.",
    itinerary: [
      { day: 1, title: "미륵산", places: [{ time: "10:00", name: "통영 스카이라인 루지", category: "액티비티" }, { time: "12:30", name: "한려수도 조망 케이블카", category: "관광지" }, { time: "18:00", name: "중앙시장 활어회", category: "식당" }] },
      { day: 2, title: "섬으로", places: [{ time: "09:30", name: "소매물도", category: "관광지" }] },
    ],
  },
  {
    id: "tokyo-shibuya-shopping",
    regionKey: "tokyo",
    title: "도쿄 시부야·하라주쿠 쇼핑 & 맛집",
    author: "예린",
    nights: 3,
    days: 4,
    people: 2,
    transport: "대중교통",
    travelMonth: "2025년 11월",
    budget: "120만 원",
    tips: ["스이카 카드를 휴대폰에 넣으면 지하철·편의점이 편해요.", "시부야 스카이는 해 질 무렵 예약이 제일 빨리 차요."],
    tags: ["쇼핑", "맛집 투어", "야경/나이트라이프"],
    likes: 412,
    summary: "지하철로만 다니는 동선. 낮엔 쇼핑, 저녁엔 이자카야와 전망대로 마무리해요.",
    itinerary: [
      {
        day: 1,
        title: "시부야 입성",
        places: [
          { time: "14:00", name: "시부야 스크램블 교차로", category: "관광지" },
          { time: "15:00", name: "시부야 파르코", category: "쇼핑" },
          { time: "18:00", name: "시부야 스카이", category: "관광지", note: "노을 시간 예약 필수" },
          { time: "20:00", name: "이치란 라멘 시부야점", category: "식당" },
        ],
      },
      {
        day: 2,
        title: "하라주쿠·오모테산도",
        places: [
          { time: "10:00", name: "메이지 신궁", category: "관광지" },
          { time: "12:00", name: "다케시타 거리", category: "쇼핑" },
          { time: "14:30", name: "오모테산도 카페 거리", category: "카페" },
          { time: "19:00", name: "에비스 요코초", category: "식당" },
        ],
      },
      {
        day: 3,
        title: "아사쿠사와 스카이트리",
        places: [
          { time: "10:00", name: "센소지", category: "관광지" },
          { time: "13:00", name: "도쿄 스카이트리", category: "관광지" },
          { time: "18:00", name: "츠키지 장외시장", category: "식당" },
        ],
      },
      { day: 4, title: "귀국", places: [{ time: "10:00", name: "긴자 쇼핑", category: "쇼핑" }] },
    ],
  },
  {
    id: "tokyo-odaiba-family",
    regionKey: "tokyo",
    title: "아이와 함께 도쿄 오다이바",
    author: "준맘",
    nights: 2,
    days: 3,
    people: 3,
    transport: "대중교통",
    travelMonth: "2026년 4월",
    budget: "150만 원",
    tips: ["유리카모메 1일권이 오다이바 이동에 제일 편해요."],
    tags: ["야외 액티비티", "실내 문화/전시"],
    likes: 203,
    summary: "체험형 전시와 바닷가 공원 위주로, 아이 컨디션에 맞춘 느긋한 일정이에요.",
    itinerary: [
      { day: 1, title: "오다이바", places: [{ time: "11:00", name: "팀랩 플래닛", category: "문화/전시" }, { time: "15:00", name: "오다이바 해변공원", category: "휴식" }] },
      { day: 2, title: "우에노", places: [{ time: "10:00", name: "우에노 동물원", category: "관광지" }, { time: "14:00", name: "국립과학박물관", category: "문화/전시" }] },
      { day: 3, title: "귀국", places: [{ time: "10:00", name: "도쿄역 캐릭터 스트리트", category: "쇼핑" }] },
    ],
  },
  {
    id: "osaka-eat",
    regionKey: "osaka",
    title: "오사카 먹방 & 유니버설 스튜디오",
    author: "태윤",
    nights: 2,
    days: 3,
    people: 4,
    transport: "대중교통",
    travelMonth: "2025년 12월",
    budget: "95만 원",
    tips: ["USJ 익스프레스 패스는 한 달 전에 매진돼요.", "도톤보리는 밤 10시 이후가 오히려 한산해요."],
    tags: ["맛집 투어", "야외 액티비티"],
    likes: 388,
    summary: "하루는 USJ에 통째로, 나머지는 도톤보리·신세카이에서 먹기만 하는 일정이에요.",
    itinerary: [
      { day: 1, title: "도톤보리", places: [{ time: "13:00", name: "구로몬 시장", category: "식당" }, { time: "16:00", name: "오사카성", category: "관광지" }, { time: "19:00", name: "도톤보리", category: "식당", note: "타코야키·오코노미야키" }] },
      { day: 2, title: "USJ", places: [{ time: "08:30", name: "유니버설 스튜디오 재팬", category: "액티비티" }] },
      { day: 3, title: "신세카이", places: [{ time: "11:00", name: "츠텐카쿠", category: "관광지" }, { time: "12:30", name: "신세카이 쿠시카츠", category: "식당" }] },
    ],
  },
  {
    id: "fukuoka-weekend",
    regionKey: "fukuoka",
    title: "후쿠오카 금토일 주말 여행",
    author: "소희",
    nights: 2,
    days: 3,
    people: 2,
    transport: "대중교통",
    travelMonth: "2026년 2월",
    budget: "60만 원",
    tips: ["공항에서 하카타역까지 지하철로 5분이에요.", "나카스 포장마차는 현금만 받는 곳이 많아요."],
    tags: ["맛집 투어", "힐링", "카페 투어"],
    likes: 265,
    summary: "가까워서 금요일 퇴근 후 출발! 라멘·모츠나베·포장마차를 다 먹고 와요.",
    itinerary: [
      { day: 1, title: "하카타 도착", places: [{ time: "20:00", name: "나카스 포장마차 거리", category: "식당" }] },
      { day: 2, title: "다자이후", places: [{ time: "10:00", name: "다자이후 텐만구", category: "관광지" }, { time: "15:00", name: "오호리 공원", category: "휴식" }, { time: "19:00", name: "모츠나베 라쿠텐치", category: "식당" }] },
      { day: 3, title: "텐진 쇼핑", places: [{ time: "11:00", name: "텐진 지하상가", category: "쇼핑" }, { time: "13:00", name: "이치란 본점", category: "식당" }] },
    ],
  },
  {
    id: "taipei-nightmarket",
    regionKey: "taipei",
    title: "타이베이 야시장 & 지우펀 데이트",
    author: "하린",
    nights: 2,
    days: 3,
    people: 2,
    transport: "대중교통",
    travelMonth: "2025년 10월",
    budget: "70만 원",
    tips: ["지우펀은 해 질 녘에 가야 홍등이 켜진 골목을 볼 수 있어요.", "이지카드 하나로 MRT·버스·편의점 다 돼요."],
    tags: ["야경/나이트라이프", "맛집 투어"],
    likes: 297,
    summary: "낮엔 시내, 밤엔 야시장. 하루는 지우펀·스펀으로 근교 여행을 다녀와요.",
    itinerary: [
      { day: 1, title: "시내", places: [{ time: "14:00", name: "타이베이 101", category: "관광지" }, { time: "17:00", name: "딘타이펑 본점", category: "식당" }, { time: "20:00", name: "스린 야시장", category: "식당" }] },
      { day: 2, title: "근교", places: [{ time: "11:00", name: "스펀 천등 날리기", category: "액티비티" }, { time: "16:00", name: "지우펀 옛거리", category: "관광지" }] },
      { day: 3, title: "귀국 전", places: [{ time: "10:00", name: "용산사", category: "관광지" }] },
    ],
  },
  {
    id: "danang-resort",
    regionKey: "danang",
    title: "다낭 리조트 휴양 & 호이안 야경",
    author: "민호",
    nights: 3,
    days: 4,
    people: 4,
    transport: "자차",
    travelMonth: "2026년 3월",
    budget: "110만 원",
    tips: ["그랩(Grab) 앱 하나면 이동은 끝이에요.", "바나힐은 오전 일찍 가야 덜 붐벼요."],
    tags: ["호캉스", "힐링", "야경/나이트라이프"],
    likes: 331,
    summary: "리조트 수영장에서 쉬다가, 저녁엔 호이안 올드타운 등불 구경을 가요.",
    itinerary: [
      { day: 1, title: "미케 비치", places: [{ time: "15:00", name: "미케 비치", category: "휴식" }, { time: "19:00", name: "한시장 야시장", category: "식당" }] },
      { day: 2, title: "바나힐", places: [{ time: "08:00", name: "바나힐 골든브릿지", category: "관광지" }] },
      { day: 3, title: "호이안", places: [{ time: "16:00", name: "호이안 올드타운", category: "관광지", note: "소원등 띄우기" }] },
      { day: 4, title: "귀국", places: [{ time: "10:00", name: "다낭 대성당", category: "관광지" }] },
    ],
  },
  {
    id: "bangkok-rooftop",
    regionKey: "bangkok",
    title: "방콕 사원 투어 & 루프탑 바",
    author: "지훈",
    nights: 3,
    days: 4,
    people: 3,
    transport: "대중교통",
    travelMonth: "2026년 1월",
    budget: "85만 원",
    tips: ["왕궁은 반바지·민소매 입장이 안 돼요.", "짜오프라야강 수상버스가 교통체증을 피하는 꿀팁!"],
    tags: ["역사 탐방", "야경/나이트라이프", "맛집 투어"],
    likes: 242,
    summary: "오전엔 사원, 오후엔 마사지, 밤엔 루프탑. 더위를 피하는 동선이에요.",
    itinerary: [
      { day: 1, title: "왕궁 주변", places: [{ time: "09:00", name: "왕궁", category: "관광지" }, { time: "11:30", name: "왓 포", category: "관광지" }, { time: "17:00", name: "왓 아룬", category: "관광지", note: "노을 명소" }] },
      { day: 2, title: "쇼핑", places: [{ time: "11:00", name: "아이콘시암", category: "쇼핑" }, { time: "20:00", name: "시로코 루프탑 바", category: "식당" }] },
      { day: 3, title: "주말 시장", places: [{ time: "10:00", name: "짜뚜짝 주말시장", category: "쇼핑" }] },
      { day: 4, title: "귀국", places: [{ time: "10:00", name: "타이 마사지", category: "휴식" }] },
    ],
  },
  {
    id: "paris-museum",
    regionKey: "paris",
    title: "파리 미술관 & 센강 산책 5일",
    author: "다은",
    nights: 4,
    days: 5,
    people: 2,
    transport: "도보 위주",
    travelMonth: "2025년 9월",
    budget: "320만 원",
    tips: ["뮤지엄 패스로 줄을 덜 서요.", "에펠탑은 정각마다 5분간 반짝여요."],
    tags: ["실내 문화/전시", "카페 투어", "야경/나이트라이프"],
    likes: 356,
    summary: "하루 한 곳의 미술관과 동네 산책. 걸어서 파리를 천천히 느끼는 일정이에요.",
    itinerary: [
      { day: 1, title: "마레 지구", places: [{ time: "15:00", name: "마레 지구 산책", category: "관광지" }, { time: "19:00", name: "센강 유람선", category: "액티비티" }] },
      { day: 2, title: "루브르", places: [{ time: "09:00", name: "루브르 박물관", category: "문화/전시" }, { time: "14:00", name: "튈르리 정원", category: "휴식" }] },
      { day: 3, title: "오르세 · 생제르맹", places: [{ time: "10:00", name: "오르세 미술관", category: "문화/전시" }, { time: "15:00", name: "카페 드 플로르", category: "카페" }] },
      { day: 4, title: "몽마르트르", places: [{ time: "11:00", name: "몽마르트르 언덕", category: "관광지" }, { time: "20:00", name: "에펠탑 야경", category: "관광지" }] },
      { day: 5, title: "귀국", places: [{ time: "10:00", name: "갤러리 라파예트", category: "쇼핑" }] },
    ],
  },
  {
    id: "hawaii-waikiki",
    regionKey: "hawaii",
    title: "하와이 와이키키 느린 여행",
    author: "수아",
    nights: 4,
    days: 5,
    people: 2,
    transport: "자차",
    travelMonth: "2026년 5월",
    budget: "380만 원",
    tips: ["다이아몬드 헤드는 입장 예약이 필수예요.", "렌터카는 노스쇼어 가는 날만 빌려도 충분해요."],
    tags: ["힐링", "자연 경관", "호캉스"],
    likes: 189,
    summary: "와이키키 해변에서 쉬다가, 하루는 차를 빌려 노스쇼어까지 드라이브해요.",
    itinerary: [
      { day: 1, title: "와이키키", places: [{ time: "15:00", name: "와이키키 해변", category: "휴식" }] },
      { day: 2, title: "다이아몬드 헤드", places: [{ time: "07:00", name: "다이아몬드 헤드", category: "액티비티" }, { time: "12:00", name: "카이무키 브런치", category: "카페" }] },
      { day: 3, title: "노스쇼어", places: [{ time: "10:00", name: "할레이바 타운", category: "관광지" }, { time: "13:00", name: "새우 트럭", category: "식당" }] },
      { day: 4, title: "하나우마 베이", places: [{ time: "08:00", name: "하나우마 베이", category: "액티비티", note: "스노클링" }] },
      { day: 5, title: "귀국", places: [{ time: "10:00", name: "알라모아나 센터", category: "쇼핑" }] },
    ],
  },
];

// ---------------------------------------------------------------------------
// 목록을 넉넉하게: 기존 계획을 바탕으로 작성자·시기·분위기를 바꾼 변형 계획을 만든다 (목데이터)
// ---------------------------------------------------------------------------

const AUTHORS = ["유진", "도현", "서윤", "하준", "지아", "시우", "채원", "은우", "나연", "건우", "다인", "로운", "보민", "윤서"];
const MOODS = [
  { title: "느긋하게 걷는", tags: ["힐링", "자연 경관"], summary: "하루 3~4곳만 천천히, 쉬는 시간을 넉넉히 넣었어요." },
  { title: "알차게 꽉 채운", tags: ["맛집 투어", "쇼핑"], summary: "아침부터 밤까지 동선을 촘촘하게 짠 효율 코스예요." },
  { title: "사진 잘 나오는", tags: ["카페 투어", "자연 경관"], summary: "뷰 좋은 카페와 포토 스팟 위주로 골랐어요." },
  { title: "부모님과 함께하는", tags: ["힐링", "역사 탐방"], summary: "많이 걷지 않고 쉬어 가기 좋은 곳들로 구성했어요." },
  { title: "밤이 더 예쁜", tags: ["야경/나이트라이프", "맛집 투어"], summary: "낮엔 여유롭게, 저녁부터 야경과 맛집을 즐겨요." },
];
const MONTHS = ["2025년 4월", "2025년 6월", "2025년 8월", "2025년 10월", "2025년 12월", "2026년 2월", "2026년 3월", "2026년 5월"];

function variantsOf(base: SharedPlan, n: number, seed: number): SharedPlan[] {
  const region = REGIONS.find((r) => r.key === base.regionKey);
  return Array.from({ length: n }, (_, i) => {
    const k = seed * 7 + i * 3;
    const mood = MOODS[k % MOODS.length];
    return {
      ...base,
      id: `${base.id}-v${i + 2}`,
      author: AUTHORS[k % AUTHORS.length],
      title: `${mood.title} ${region?.name ?? ""} ${base.nights ? `${base.nights}박 ${base.days}일` : "당일치기"}`,
      travelMonth: MONTHS[k % MONTHS.length],
      tags: Array.from(new Set([...mood.tags, base.tags[0]])),
      likes: Math.max(12, Math.round(base.likes * (0.25 + ((k * 37) % 60) / 100))),
      summary: mood.summary,
    };
  });
}

SHARED_PLANS.push(...SHARED_PLANS.slice().flatMap((p, i) => variantsOf(p, 2, i)));

export const AREAS = [
  { key: "all", label: "전체" },
  { key: "domestic", label: "국내" },
  { key: "overseas", label: "해외" },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];

export function regionsByArea(area: string | undefined): Region[] {
  if (area === "domestic") return REGIONS.filter((r) => !r.overseas);
  if (area === "overseas") return REGIONS.filter((r) => r.overseas);
  return REGIONS;
}

export function plansByArea(plans: SharedPlan[], area: string | undefined): SharedPlan[] {
  if (area !== "domestic" && area !== "overseas") return plans;
  const keys = new Set(regionsByArea(area).map((r) => r.key));
  return plans.filter((p) => keys.has(p.regionKey));
}

/** "제주" / "도쿄 · 일본" */
export const regionLabel = (r: Region) => (r.overseas ? `${r.name} · ${r.country}` : r.name);

/** 국내·해외 섞어서 계획이 많은 여행지 n곳 */
export const popularRegions = (n: number) => [...REGIONS].sort((a, b) => b.planCount - a.planCount).slice(0, n);

/** 사진 위 지역 배지 색: 국내는 연한 코랄, 해외는 연한 블루·퍼플 (국내/해외 탭 색과 맞춤) */
export const regionPillTone = (r?: Region) =>
  r?.overseas ? "bg-gradient-to-r from-sky-100 to-lilac-100 text-lilac-700" : "bg-gradient-to-r from-peach-100 to-rose-100 text-rose-700";

export const regionByKey = (key: string) => REGIONS.find((r) => r.key === key);
export const plansByRegion = (key: string) => SHARED_PLANS.filter((p) => p.regionKey === key);
export const planById = (id: string) => SHARED_PLANS.find((p) => p.id === id);
export const featuredPlans = (n = 8) => [...SHARED_PLANS].sort((a, b) => b.likes - a.likes).slice(0, n);
/** "2025년 10월" -> "10월 · 가을" */
export function monthSeason(travelMonth: string): string {
  const m = Number(/(\d{1,2})월/.exec(travelMonth)?.[1]);
  if (!m) return travelMonth;
  const season = m >= 3 && m <= 5 ? "봄" : m >= 6 && m <= 8 ? "여름" : m >= 9 && m <= 11 ? "가을" : "겨울";
  return `${m}월 · ${season}`;
}

export const SORTS = [
  { key: "popular", label: "인기순" },
  { key: "recent", label: "최근 다녀온 순" },
  { key: "short", label: "짧은 일정순" },
  { key: "long", label: "긴 일정순" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

const monthValue = (m: string) => {
  const [, y, mo] = /(\d{4})년\s*(\d{1,2})월/.exec(m) ?? [];
  return Number(y ?? 0) * 100 + Number(mo ?? 0);
};

export function sortPlans(plans: SharedPlan[], sort: string | undefined): SharedPlan[] {
  const list = [...plans];
  switch (sort as SortKey) {
    case "recent":
      return list.sort((a, b) => monthValue(b.travelMonth) - monthValue(a.travelMonth) || b.likes - a.likes);
    case "short":
      return list.sort((a, b) => a.days - b.days || b.likes - a.likes);
    case "long":
      return list.sort((a, b) => b.days - a.days || b.likes - a.likes);
    default:
      return list.sort((a, b) => b.likes - a.likes);
  }
}

/** 검색: 여행지·제목·소개·태그·작성자·들르는 장소까지 (공백으로 나눈 단어가 모두 포함되면 일치) */
const MEMBER_POOL = ["서연", "도윤", "하은", "지호", "수아", "민준", "채원", "건우", "유나", "시우", "다인", "준서"];

/** 함께 계획한 사람들 (작성자 + 동행). 목데이터라 계획 id 로 이름을 고정해서 뽑는다 */
export function planMembers(plan: Pick<SharedPlan, "id" | "author" | "people">): string[] {
  let seed = [...plan.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0;
  const pool = MEMBER_POOL.filter((n) => n !== plan.author);
  const others: string[] = [];
  for (let i = 1; i < Math.max(1, plan.people) && pool.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    others.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return [plan.author, ...others];
}

/** 해시태그 검색 주소 */
export const tagSearchHref = (tag: string) => `/explore?q=${encodeURIComponent(`#${tag}`)}`;

export function searchPlans(plans: SharedPlan[], q: string | undefined): SharedPlan[] {
  // "#카페 투어" 처럼 #으로 시작하면 해시태그 정확히 일치
  const trimmed = (q ?? "").trim();
  if (trimmed.startsWith("#")) {
    const tag = trimmed.slice(1).trim();
    return plans.filter((p) => p.tags.includes(tag));
  }
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return plans;
  return plans.filter((p) => {
    const region = regionByKey(p.regionKey);
    const haystack = [
      region?.name,
      region?.tagline,
      p.title,
      p.summary,
      p.author,
      p.transport,
      p.travelMonth,
      ...p.tags,
      ...p.itinerary.flatMap((d) => [d.title, ...d.places.flatMap((pl) => [pl.name, pl.category, pl.note ?? ""])]),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export const periodLabel = (p: Pick<SharedPlan, "nights" | "days">) => (p.nights ? `${p.nights}박 ${p.days}일` : "당일치기");
