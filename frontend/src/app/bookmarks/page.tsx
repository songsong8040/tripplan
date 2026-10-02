import { Shell } from "@/components/layout/Shell";
import { BookmarkList } from "@/components/explore/BookmarkList";
import { Toaster } from "@/components/trip/Toaster";

export const metadata = { title: "북마크 · tripplan" };

/** 북마크한 여행 계획 */
export default function BookmarksPage() {
  return (
    <Shell backHref="/" title="북마크">
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-[1.75rem] font-bold tracking-tight sm:text-3xl">북마크</h1>
          <p className="text-sm text-ink-500">마음에 들어 저장해 둔 여행 계획이에요. 이 기기에 저장돼요.</p>
        </header>
        <BookmarkList />
      </div>
      <Toaster />
    </Shell>
  );
}
