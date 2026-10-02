import { endTime, formatDuration } from "@/lib/format";
import { mapLinks } from "@/lib/links";
import type { PlanOption, Trip } from "@/lib/types";

const HEADERS = [
  "일차",
  "날짜",
  "시간",
  "장소",
  "카테고리",
  "위치",
  "체류",
  "영업시간",
  "브레이크타임",
  "휴무",
  "메모",
  "추천 사유",
  "좋아요",
  "카카오맵",
  "네이버지도",
  "구글 지도",
] as const;

const COL_WIDTHS = [6, 12, 13, 26, 10, 16, 9, 13, 13, 8, 28, 40, 7, 12, 12, 12];
const LINK_COLS = [13, 14, 15];

function planRows(plan: PlanOption) {
  return plan.days.flatMap((day) =>
    day.items.map((item) => {
      const links = mapLinks(item);
      const end = endTime(item);
      return {
        values: [
          `Day ${day.day}`,
          day.date ?? "",
          item.start_time ? `${item.start_time}${end ? `–${end}` : ""}` : "",
          item.name,
          item.category,
          item.address || item.area,
          formatDuration(item.duration_minutes),
          item.open_time && item.close_time ? `${item.open_time}–${item.close_time}` : "",
          item.break_start && item.break_end ? `${item.break_start}–${item.break_end}` : "",
          item.closed_days.join(","),
          item.memo,
          item.reason,
          Object.values(item.votes).filter((v) => v === "like").length,
          "카카오맵 열기",
          "네이버지도 열기",
          "구글 지도 열기",
        ],
        links: [links.kakao, links.naver, links.google],
      };
    })
  );
}

/** 1안/2안을 각각 시트로 만든 엑셀 파일을 브라우저에서 바로 다운로드한다. */
export async function downloadTripXlsx(trip: Trip) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const title = trip.spec?.title || `${trip.spec?.region ?? ""} 여행`;

  for (const plan of trip.plans) {
    const rows = planRows(plan);
    const aoa: (string | number)[][] = [
      [`${title} · ${plan.label} ${plan.title}`],
      [plan.concept],
      [],
      [...HEADERS],
      ...rows.map((r) => r.values),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRow = 3; // 0-based
    const lastCol = HEADERS.length - 1;

    ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    ];
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + rows.length, c: lastCol } }),
    };

    rows.forEach((row, i) => {
      LINK_COLS.forEach((c, j) => {
        const cell = ws[XLSX.utils.encode_cell({ r: headerRow + 1 + i, c })];
        if (cell) cell.l = { Target: row.links[j], Tooltip: row.values[3] as string };
      });
    });

    XLSX.utils.book_append_sheet(wb, ws, `${plan.label} ${plan.title}`.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  }

  const safeName = title.replace(/[\\/:*?"<>|]/g, "").trim() || "여행 계획";
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}
