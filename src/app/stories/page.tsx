import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StoryCard } from "@/components/content-card";
import { getStories } from "@/lib/data";

export const dynamic = "force-dynamic";

const filters = ["추천", "신작", "전체", "현대판타지", "로맨스", "액션"];

export default async function StoriesPage() {
  const stories = await getStories();

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-leaf-600">Story Library</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">스토리 탐색</h1>
            <p className="mt-2 text-[#66705f]">세계관을 고르고 나만의 설정을 더해 롤플레잉 채팅을 시작하세요.</p>
          </div>
          <Link href="/create/story" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
            <Plus size={18} /> 스토리 만들기
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter, index) => (
            <button
              key={filter}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm ${
                index === 0 ? "border-leaf-500 bg-leaf-500 text-white" : "border-[#dce8d1] bg-white text-[#526047]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
