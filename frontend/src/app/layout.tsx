import type { Metadata, Viewport } from "next";

import { config } from "@fortawesome/fontawesome-svg-core";

import { TooltipProvider } from "@/components/ui/tooltip";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

// Font Awesome CSS 는 위에서 직접 불러오므로 런타임 자동 삽입을 끈다 (깜빡임 방지)
config.autoAddCss = false;

export const metadata: Metadata = {
  title: "TripPlan · 함께 만드는 AI 여행 계획",
  description: "로그인 없이 링크로 모여 AI 추천 여행 일정을 함께 조율하고 공유하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="font-sans">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
