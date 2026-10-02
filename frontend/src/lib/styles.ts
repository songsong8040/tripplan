/**
 * 파스텔 포인트 컬러 매핑 (카테고리 · 여행 테마)
 * Tailwind 가 클래스를 찾을 수 있도록 전체 클래스 문자열을 그대로 적는다.
 */
import {
  BedDouble,
  Bike,
  Camera,
  Coffee,
  Hotel,
  Landmark,
  Leaf,
  Moon,
  Mountain,
  Palette,
  Route,
  Running,
  ShoppingBag,
  Star,
  Utensils,
  IndoorPlay,
  Workshop,
  ThemePark,
  Beach,
  Hiking,
  Spa,
  Show,
  PhotoSpot,
  Market,
  Drive,
  Kids,
  Pet,
  type LucideIcon,
} from "@/components/ui/icons";
import type { Category, Theme } from "@/lib/types";

export interface Tone {
  /** 연한 배경 + 진한 글자 (배지·아이콘 칩) */
  soft: string;
  /** 아주 연한 배경 (카드·섹션) */
  wash: string;
  icon: LucideIcon;
}

export const CATEGORY_STYLE: Record<Category, Tone> = {
  식당: { soft: "bg-peach-100 text-peach-700", wash: "bg-peach-50", icon: Utensils },
  카페: { soft: "bg-butter-100 text-butter-700", wash: "bg-butter-50", icon: Coffee },
  관광지: { soft: "bg-sky-100 text-sky-700", wash: "bg-sky-50", icon: Camera },
  액티비티: { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Running },
  쇼핑: { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: ShoppingBag },
  숙소: { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: BedDouble },
  "문화/전시": { soft: "bg-rose-100 text-rose-700", wash: "bg-rose-50", icon: Palette },
  휴식: { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Leaf },
  이동: { soft: "bg-ink-100 text-ink-600", wash: "bg-ink-50", icon: Route },
  기타: { soft: "bg-ink-100 text-ink-600", wash: "bg-ink-50", icon: Star },
};

export const categoryStyle = (category: string): Tone =>
  CATEGORY_STYLE[category as Category] ?? CATEGORY_STYLE["기타"];

export const THEME_STYLE: Record<Theme, Tone> = {
  힐링: { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Leaf },
  "맛집 투어": { soft: "bg-peach-100 text-peach-700", wash: "bg-peach-50", icon: Utensils },
  "카페 투어": { soft: "bg-butter-100 text-butter-700", wash: "bg-butter-50", icon: Coffee },
  "야외 액티비티": { soft: "bg-sky-100 text-sky-700", wash: "bg-sky-50", icon: Bike },
  "실내 문화/전시": { soft: "bg-rose-100 text-rose-700", wash: "bg-rose-50", icon: Palette },
  쇼핑: { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: ShoppingBag },
  호캉스: { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: Hotel },
  "자연 경관": { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Mountain },
  "역사 탐방": { soft: "bg-butter-100 text-butter-700", wash: "bg-butter-50", icon: Landmark },
  "야경/나이트라이프": { soft: "bg-sky-100 text-sky-700", wash: "bg-sky-50", icon: Moon },
  "실내 액티비티": { soft: "bg-peach-100 text-peach-700", wash: "bg-peach-50", icon: IndoorPlay },
  "체험/클래스": { soft: "bg-butter-100 text-butter-700", wash: "bg-butter-50", icon: Workshop },
  "테마파크": { soft: "bg-rose-100 text-rose-700", wash: "bg-rose-50", icon: ThemePark },
  "바다/해변": { soft: "bg-sky-100 text-sky-700", wash: "bg-sky-50", icon: Beach },
  "등산/트레킹": { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Hiking },
  "스파/온천": { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: Spa },
  "공연/축제": { soft: "bg-rose-100 text-rose-700", wash: "bg-rose-50", icon: Show },
  "사진 명소": { soft: "bg-sky-100 text-sky-700", wash: "bg-sky-50", icon: PhotoSpot },
  "로컬 시장": { soft: "bg-peach-100 text-peach-700", wash: "bg-peach-50", icon: Market },
  "드라이브": { soft: "bg-mint-100 text-mint-700", wash: "bg-mint-50", icon: Drive },
  "아이와 함께": { soft: "bg-butter-100 text-butter-700", wash: "bg-butter-50", icon: Kids },
  "반려동물 동반": { soft: "bg-lilac-100 text-lilac-700", wash: "bg-lilac-50", icon: Pet },
};
