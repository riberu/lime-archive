import Link from "next/link";
import { Plus, Share2, SlidersHorizontal } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { demoCharacters, demoStories } from "@/lib/mock-data";

export default function MyWorksPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-leaf-600">Creator Desk</p>
            <h1 className="mt-2 text-3xl font-semibold">내 작품</h1>
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
        <div className="flex flex-wrap items-center gap-2">
          {["전체", "스토리", "캐릭터", "공개", "비공개"].map((item, index) => (
            <button key={item} className={`h-9 rounded-full border px-4 text-sm ${index === 0 ? "border-leaf-500 bg-leaf-50 text-leaf-900" : "border-[#dce8d1] bg-white"}`}>
              {item}
            </button>
          ))}
          <button className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-[#dce8d1] bg-white px-4 text-sm">
            <SlidersHorizontal size={16} /> 최신순
          </button>
        </div>
        <div className="rounded-lg border border-[#e0ead4] bg-white">
          {[...demoStories.map((item) => ({ type: "스토리", title: item.title, description: item.description, status: item.visibility })),
            ...demoCharacters.map((item) => ({ type: "캐릭터", title: item.name, description: item.description, status: item.visibility }))].map((item) => (
            <div key={`${item.type}-${item.title}`} className="grid gap-3 border-b border-[#eef4e8] p-4 last:border-b-0 md:grid-cols-[100px_1fr_auto] md:items-center">
              <span className="w-fit rounded-full bg-leaf-50 px-3 py-1 text-xs font-medium text-leaf-900">{item.type}</span>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 line-clamp-1 text-sm text-[#66705f]">{item.description}</p>
              </div>
              <div className="flex gap-2">
                <button className="h-9 rounded-md border border-[#dce8d1] px-3 text-sm">수정</button>
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#dce8d1] px-3 text-sm">
                  <Share2 size={15} /> 공유
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
