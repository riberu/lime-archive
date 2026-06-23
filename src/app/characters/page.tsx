import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { CharacterCard } from "@/components/content-card";
import { getCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const characters = await getCharacters();

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-leaf-600">Character Index</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">캐릭터 탐색</h1>
            <p className="mt-2 text-[#66705f]">단독 캐릭터로 만들거나, 스토리의 등장인물로 연결할 수 있습니다.</p>
          </div>
          <Link href="/create/character" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
            <Plus size={18} /> 캐릭터 만들기
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
