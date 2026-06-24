import Link from "next/link";
import { Bot, Plus } from "lucide-react";
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
            <p className="text-sm font-bold text-[#4d6b00]">Character Index</p>
            <h1 className="mt-2 font-story text-3xl font-extrabold tracking-tight">캐릭터 탐색</h1>
            <p className="mt-2 text-[#6b7280]">독립 캐릭터를 만들거나 스토리의 등장인물로 연결할 수 있습니다.</p>
          </div>
          <Link href="/create/character" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#a3e635] px-4 text-sm font-extrabold text-[#1a2e05] hover:bg-[#bef264]">
            <Plus size={18} /> 캐릭터 만들기
          </Link>
        </div>

        <div className="ui-panel-card p-5">
          <div className="mb-5 flex items-center gap-2">
            <span className="ui-icon-btn ui-icon-btn-active"><Bot size={18} /></span>
            <h2 className="ui-shelf-title">등록된 캐릭터</h2>
          </div>
          {characters.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {characters.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          ) : (
            <Link href="/create/character" className="block rounded-xl bg-[#f7f7f8] p-8 text-center text-sm font-semibold text-[#6b7280]">
              아직 등록된 캐릭터가 없습니다. 첫 캐릭터를 만들어 주세요.
            </Link>
          )}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
