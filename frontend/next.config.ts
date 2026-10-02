import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // 미리보기용 서버를 동시에 띄울 때 빌드 폴더가 겹치지 않도록 (기본값 .next)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // 둘러보기 대표 이미지 (위키미디어 공용)
  images: {
    remotePatterns: [{ protocol: "https", hostname: "upload.wikimedia.org" }],
  },
  // 브라우저는 같은 Origin 의 /api/* 로 호출하고, Next 가 FastAPI 로 프록시한다.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  experimental: {
    // AI 생성(대체 모델 재시도 포함)은 최대 150초까지 걸릴 수 있어 프록시 타임아웃을 늘린다.
    proxyTimeout: 180_000,
  },
};

export default nextConfig;
