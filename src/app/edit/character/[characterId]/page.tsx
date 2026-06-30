import { notFound } from "next/navigation";
import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";
import { getCharacter } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = await getCharacter(characterId);
  if (!character || character.id !== characterId) notFound();

  const parsed = parseCharacterPrompt(character.prompt);

  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Edit Character</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">캐릭터 수정</h1>
          <p className="mt-2 text-[#6b7280]">캐릭터 제작 양식 그대로 설정을 다시 열어 수정합니다.</p>
        </div>
        <CreatorLongForm
          type="character"
          mode="edit"
          itemId={character.id}
          initialImageUrl={character.avatarUrl}
          initialDraft={{
            name: character.name,
            description: character.description,
            gender: character.gender,
            age: character.age,
            avatar_url: character.avatarUrl,
            character_tags: parsed["Character tags"] ?? "",
            first_message: character.firstMessage,
            intro_scene: parsed["Intro scene"] ?? "",
            prompt: character.prompt,
            memory_rules: parsed["Memory rules"] ?? "",
            response_rules: parsed["Response rules"] ?? "",
            personality: character.personality,
            speech_style: character.speechStyle,
            relationship: parsed["Relationship memory"] ?? ""
          }}
        />
      </section>
    </WorkspaceLayout>
  );
}

function parseCharacterPrompt(prompt: string) {
  const values: Record<string, string> = {};
  for (const line of prompt.split("\n")) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}
