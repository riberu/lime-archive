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
  const newStories = stories.slice(0, 6);

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-leaf-600">Story Library</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">스토리 탐색</h1>
            <p className="mt-2 text-[#66705f]">추천작, 신작, 장르별 목록에서 바로 롤플레잉 채팅을 시작하세요.</p>
          </div>
          <Link href="/create/story" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
            <Plus size={18} /> 스토리 만들기
          </Link>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="스토리 탐색 필터">
          <Link href="/stories" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-leaf-500 bg-leaf-500 px-4 text-sm text-white">
            <Sparkles size={15} /> 추천
          </Link>
          <a href="#new" className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#dce8d1] bg-white px-4 text-sm text-[#526047] hover:bg-leaf-50">
            신작
          </a>
          {genreItems.map((genre) => (
            <Link
              key={genre.slug}
              href={`/stories/genre/${genre.slug}`}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#dce8d1] bg-white px-4 text-sm text-[#526047] hover:bg-leaf-50"
            >
              {genre.label}
            </Link>
          ))}
        </nav>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={19} className="text-leaf-600" />
            <h2 className="text-xl font-semibold">추천 스토리</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>

        <section id="new" className="space-y-4 scroll-mt-20">
          <div className="flex items-center gap-2">
            <Compass size={19} className="text-leaf-600" />
            <h2 className="text-xl font-semibold">신작</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {newStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}
