import Link from "next/link";
import { Compass, Plus, Sparkles } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StoryCard } from "@/components/content-card";
import { getStories } from "@/lib/data";
import { genreItems, getFeaturedStories } from "@/lib/genres";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const stories = await getStories();
  const featuredStories = getFeaturedStories(stories);
  const newStories = stories.slice(0, 8);

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-[#4d6b00]">Story Library</p>
            <h1 className="mt-2 font-story text-3xl font-extrabold tracking-tight">스토리 탐색</h1>
            <p className="mt-2 text-[#6b7280]">추천작, 신작, 장르별 목록에서 바로 롤플레잉 채팅을 시작하세요.</p>
          </div>
          <Link href="/create/story" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#a3e635] px-4 text-sm font-extrabold text-[#1a2e05] hover:bg-[#bef264]">
            <Plus size={18} /> 스토리 만들기
          </Link>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="스토리 탐색 필터">
          <Link href="/stories" className="ui-chip ui-chip-active inline-flex items-center gap-2">
            <Sparkles size={15} /> 추천
          </Link>
          <a href="#new" className="ui-chip inline-flex items-center">신작</a>
          {genreItems.map((genre) => (
            <Link key={genre.slug} href={`/stories/genre/${genre.slug}`} className="ui-chip inline-flex items-center">
              {genre.label}
            </Link>
          ))}
        </nav>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="ui-icon-btn ui-icon-btn-active"><Sparkles size={18} /></span>
            <h2 className="ui-shelf-title">추천 스토리</h2>
          </div>
          <div className="ui-track">
            {featuredStories.length ? featuredStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyState href="/create/story" label="아직 등록된 스토리가 없습니다." />}
          </div>
        </section>

        <section id="new" className="space-y-4 scroll-mt-20">
          <div className="flex items-center gap-2">
            <span className="ui-icon-btn"><Compass size={18} /></span>
            <h2 className="ui-shelf-title">신작</h2>
          </div>
          <div className="ui-track">
            {newStories.length ? newStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyState href="/create/story" label="첫 스토리를 만들어 주세요." />}
          </div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}

function EmptyState({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="ui-panel-card flex min-h-[160px] min-w-[288px] items-center justify-center px-6 text-center text-sm font-semibold text-[#6b7280]">
      {label}
    </Link>
  );
}
