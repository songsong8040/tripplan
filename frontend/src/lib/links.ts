import type { PlanItem } from "@/lib/types";

type LinkTarget = Pick<PlanItem, "name" | "search_keyword" | "area"> & Partial<Pick<PlanItem, "place_url">>;

/** 지도 검색어: AI/검증 결과의 search_keyword 우선, 없으면 지역 + 장소명 */
export function placeQuery(item: LinkTarget): string {
  const base = item.search_keyword?.trim() || [item.area, item.name].filter(Boolean).join(" ");
  // 목업 데이터의 [예시] 접두어는 검색어에서 제외
  return base.replace(/^\[예시\]\s*/, "");
}

export function mapLinks(item: LinkTarget) {
  const q = encodeURIComponent(placeQuery(item));
  return {
    // 카카오 검증된 장소면 검색 결과 대신 장소 상세 페이지로 바로 연결
    kakao: item.place_url || `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

export function reservationLinks(item: LinkTarget) {
  const q = encodeURIComponent(placeQuery(item));
  return {
    catchtable: `https://app.catchtable.co.kr/ct/search/total?query=${q}`,
    naverBooking: `https://m.search.naver.com/search.naver?query=${q}+%EC%98%88%EC%95%BD`,
  };
}
