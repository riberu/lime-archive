import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { getCharacter } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CharacterDetailPage({
  params
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const character = await getCharacter(characterId);

  return (
    <WorkspaceLayout>
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-[#e0ead4] bg-white p-5">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-leaf-50">
            <Image src={character.avatarUrl} alt={character.name} fill priority className="object-cover" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">{character.name}</h1>
          <p className="mt-2 leading-7 text-[#66705f]">{character.description}</p>
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-leaf-500 font-semibold text-white">
            <MessageCircle size={18} /> 캐릭터 채팅 준비 중
          </button>
        </aside>

        <div className="space-y-5">
          <DetailBlock title="첫 메시지">
            <p className="prose-log font-story text-[#425038]">{character.firstMessage}</p>
          </DetailBlock>
          <DetailBlock title="성격">
            <p className="prose-log text-[#425038]">{character.personality || "아직 성격 설명이 없습니다."}</p>
          </DetailBlock>
          <DetailBlock title="말투">
            <p className="prose-log text-[#425038]">{character.speechStyle || "아직 말투 설명이 없습니다."}</p>
          </DetailBlock>
          <DetailBlock title="캐릭터 프롬프트">
            <p className="prose-log text-[#425038]">{character.prompt}</p>
          </DetailBlock>
        </div>
      </section>
    </WorkspaceLayout>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e0ead4] bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
