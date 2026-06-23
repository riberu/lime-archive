import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { WorkEditForm } from "@/components/work-edit-form";
import { getCharacter } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = await getCharacter(characterId);
  if (!character || character.id !== characterId) notFound();

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
        <div>
          <Link href="/my" className="inline-flex items-center gap-2 text-sm font-semibold text-leaf-700">
            <ArrowLeft size={16} /> 내 작품으로
          </Link>
          <p className="mt-5 text-sm font-medium text-leaf-600">Edit Character</p>
          <h1 className="mt-2 text-3xl font-semibold">캐릭터 수정</h1>
        </div>
        <WorkEditForm type="character" item={character} />
      </section>
    </WorkspaceLayout>
  );
}
