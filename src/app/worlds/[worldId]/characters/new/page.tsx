import { notFound } from "next/navigation";
import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";
import { getWorld } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CreateWorldCharacterPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const world = await getWorld(worldId);
  if (!world) notFound();

  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">World Character</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">세계관 캐릭터 만들기</h1>
          <p className="mt-2 text-[#6b7280]">{world.title} 안에서만 사용할 캐릭터를 등록합니다.</p>
        </div>
        <CreatorLongForm type="character" characterScope="world" worldId={world.id} />
      </section>
    </WorkspaceLayout>
  );
}
