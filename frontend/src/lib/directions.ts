/**
 * 지도 앱별 길찾기 링크.
 * 국내 구간: 카카오맵 · 네이버지도 · 티맵 · 구글 지도
 * 해외 구간: 구글 지도만 (카카오·네이버·티맵 길찾기는 국내 도로/대중교통 데이터만 지원)
 */
import type { Mode } from "@/lib/route";

export interface Point {
  name: string;
  lat: number;
  lng: number;
}

export interface DirectionsOption {
  key: "kakao" | "naver" | "tmap" | "google";
  label: string;
  url: string;
  /** 앱 전용(웹 길찾기 없음) 여부 */
  appOnly?: boolean;
}

/** 대한민국 대략 영역 (제주·울릉 포함) */
export function inKorea(p: { lat: number; lng: number }): boolean {
  return p.lat >= 33.0 && p.lat <= 38.7 && p.lng >= 124.5 && p.lng <= 131.9;
}

const enc = (s: string) => encodeURIComponent(s);
// 카카오맵 URL 스킴은 쉼표·슬래시를 구분자로 쓰므로 이름에서 제거
const kakaoPoint = (p: Point) => `${enc(p.name.replace(/[,/]/g, " "))},${p.lat},${p.lng}`;

export function directionsOptions(from: Point, to: Point, mode: Mode, mobile: boolean): DirectionsOption[] {
  const google: DirectionsOption = {
    key: "google",
    label: "구글 지도",
    url: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${
      mode === "car" ? "driving" : mode === "walk" ? "walking" : "transit"
    }`,
  };
  if (!inKorea(from) || !inKorea(to)) return [google];

  const kakaoMode = mode === "car" ? "car" : mode === "walk" ? "walk" : "traffic";
  // 네이버 웹 길찾기 pathType: 0 = 자동차, 1 = 대중교통, 3 = 도보
  const naverWebType = mode === "car" ? 0 : mode === "walk" ? 3 : 1;
  const naverAppMode = mode === "car" ? "car" : mode === "walk" ? "walk" : "public";
  const naverUrl = mobile
    ? `nmap://route/${naverAppMode}?slat=${from.lat}&slng=${from.lng}&sname=${enc(from.name)}&dlat=${to.lat}&dlng=${to.lng}&dname=${enc(to.name)}&appname=tripplan`
    : `https://map.naver.com/index.nhn?slng=${from.lng}&slat=${from.lat}&stext=${enc(from.name)}&elng=${to.lng}&elat=${to.lat}&etext=${enc(to.name)}&menu=route&pathType=${naverWebType}`;

  return [
    { key: "kakao", label: "카카오맵", url: `https://map.kakao.com/link/by/${kakaoMode}/${kakaoPoint(from)}/${kakaoPoint(to)}` },
    { key: "naver", label: "네이버지도", url: naverUrl },
    {
      key: "tmap",
      label: "티맵",
      // 티맵은 웹 길찾기가 없어 앱으로 연다 (자동차 길안내)
      url: `tmap://route?startx=${from.lng}&starty=${from.lat}&startname=${enc(from.name)}&goalx=${to.lng}&goaly=${to.lat}&goalname=${enc(to.name)}`,
      appOnly: true,
    },
    google,
  ];
}
