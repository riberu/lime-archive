import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { MyWorksManager, type WorkItem } from "@/components/my-works-manager";
import { getCharacters, getStories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MyWorksPage() {
  const [stories, characters] = await Promise.all([getStories(), getCharacters()]);
  const items: WorkItem[] = [
    ...stories.map((story) => ({
      id: story.id,
      type: "story" as const,
      title: story.title,
      description: story.description,
      visibility: story.visibility
    })),
    ...characters.map((character) => ({
      id: character.id,
      type: "character" as const,
      title: character.name,
      description: character.description,
      visibility: character.visibility
    }))
  ];

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-leaf-600">Creator Desk</p>
            <h1 className="mt-2 text-3xl font-semibold">내 작품</h1>
            <p className="mt-2 text-sm text-[#66705f]">스토리와 캐릭터를 수정하거나 선택해서 삭제할 수 있습니다.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/create/story" className="inline-flex h-10 items-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white">
              <Plus size={18} /> 스토리
            </Link>
            <Link href="/create/character" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dce8d1] bg-white px-4 text-sm font-semibold">
              <Plus size={18} /> 캐릭터
            </Link>
          </div>
        </div>

        <MyWorksManager items={items} />
      </section>
    </WorkspaceLayout>
  );
}
