import { notFound } from "next/navigation";
import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";
import { getCharacters, getStory } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditStoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const story = await getStory(storyId);
  if (!story || story.id !== storyId) notFound();

  const characters = await getCharacters(story.id);
  const promptSections = parsePromptSections(story.systemPrompt);
  const tags = story.tags.join(", ");

  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Edit Story</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">스토리 수정</h1>
          <p className="mt-2 text-[#6b7280]">스토리 제작 양식 그대로 설정을 다시 열어 수정합니다.</p>
        </div>
        <CreatorLongForm
          type="story"
          mode="edit"
          itemId={story.id}
          initialImageUrl={story.thumbnailUrl}
          initialDraft={{
            title: story.title,
            description: story.description,
            thumbnail_url: story.thumbnailUrl,
            category: tags,
            tags,
            prompt_template: promptSections["Prompt Template"] ?? "",
            world: promptSections.World ?? story.systemPrompt,
            ai_rules: promptSections["AI Rules"] ?? "",
            characters: promptSections.Characters ?? "",
            opening_message: story.openingMessage,
            current_scene: story.currentScene,
            status_text: story.statusText,
            style_tone: promptSections["Style Tone"] ?? "",
            forbidden_rules: promptSections["Forbidden Rules"] ?? "",
            media_notes: promptSections["Media Notes"] ?? "",
            storyboard: promptSections.Storyboard ?? "",
            example_dialogues: promptSections["Example Dialogues"] ?? "",
            ending_rules: promptSections["Ending Rules"] ?? "",
            rating_note: promptSections["Rating / Operation Note"] ?? "",
            system_prompt: ""
          }}
          initialStoryCast={characters.map((character) => ({
            id: character.id,
            source: "existing",
            characterId: character.id,
            name: character.name,
            description: character.description,
            gender: character.gender,
            age: character.age,
            personality: character.personality,
            speechStyle: character.speechStyle,
            memo: character.roleNote ?? "",
            prompt: character.prompt,
            avatarUrl: character.avatarUrl
          }))}
        />
      </section>
    </WorkspaceLayout>
  );
}

function parsePromptSections(prompt: string) {
  const sections: Record<string, string> = {};
  const matches = [...prompt.matchAll(/^#\s+(.+)\n([\s\S]*?)(?=^#\s+|\s*$)/gm)];
  for (const match of matches) {
    sections[match[1].trim()] = match[2].trim();
  }
  return sections;
}
