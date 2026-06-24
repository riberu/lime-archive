import Image from "next/image";
import { notFound } from "next/navigation";
import { Share2 } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StartChatButton } from "@/components/start-chat-button";
import { StoryLikeButton } from "@/components/story-like-button";
import { getCharacters, getStory } from "@/lib/data";

export const dynamic = "force-dynamic";

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80";

export default async function StoryDetailPage({
  params
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const story = await getStory(storyId);
  if (!story) notFound();

  const characters = await getCharacters(story.id);
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <WorkspaceLayout>
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-[#e0ead4] bg-white">
            <div className="relative aspect-[16/8] bg-leaf-50">
              <Image src={imageSrc} alt={story.title} fill priority className="object-cover" />
            </div>
            <div className="space-y-5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold">{story.title}</h1>
                  <p className="mt-3 leading-7 text-[#526047]">{story.description}</p>
                </div>
                <div className="flex gap-2">
                  <StoryLikeButton storyId={story.id} initialLikeCount={story.likeCount} />
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dce8d1] px-3 text-sm">
                    <Share2 size={17} /> 공유
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {story.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-leaf-50 px-3 py-1 text-sm text-leaf-900">#{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <DetailBlock title="오프닝 메시지">
            <p className="prose-log font-story text-[#425038]">{story.openingMessage}</p>
          </DetailBlock>

          <DetailBlock title="현재 장면 / 상태">
            <p className="prose-log text-[#425038]">{story.currentScene}</p>
            <p className="mt-3 rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-900">{story.statusText}</p>
          </DetailBlock>

          <DetailBlock title="세계관 / AI 행동 규칙">
            <p className="prose-log text-[#425038]">{story.systemPrompt}</p>
          </DetailBlock>

          <DetailBlock title="등장 캐릭터">
            <div className="grid gap-3 md:grid-cols-2">
              {characters.length ? (
                characters.map((character) => (
                  <div key={character.id} className="rounded-lg border border-[#e0ead4] p-4">
                    <h3 className="font-semibold">{character.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#66705f]">{character.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#66705f]">아직 연결된 캐릭터가 없습니다.</p>
              )}
            </div>
          </DetailBlock>

          <DetailBlock title="댓글">
            <textarea
              id="story-comment"
              name="story_comment"
              className="min-h-24 w-full resize-none rounded-lg border border-[#dce8d1] p-3 outline-none focus:border-leaf-500"
              placeholder="댓글 기능은 이후 DB 테이블과 함께 연결할 예정입니다."
            />
            <div className="mt-3 flex justify-end">
              <button className="h-9 rounded-md bg-leaf-500 px-4 text-sm font-semibold text-white">댓글 작성</button>
            </div>
          </DetailBlock>
        </div>

        <aside className="space-y-4">
          <div className="sticky top-20 rounded-lg border border-[#e0ead4] bg-white p-5">
            <h2 className="font-semibold">시작 설정</h2>
            <div className="mt-4 rounded-lg border border-[#e0ead4] p-3 text-sm">
              <p className="font-medium">{story.statusText}</p>
              <p className="mt-2 leading-6 text-[#66705f]">{story.currentScene}</p>
            </div>
            <div className="mt-5 rounded-lg bg-leaf-50 p-3">
              <p className="text-sm font-medium">유저 프로필</p>
              <p className="mt-1 text-sm leading-6 text-[#66705f]">채팅방에서 유저 노트로 언제든 수정할 수 있습니다.</p>
            </div>
            <StartChatButton storyId={story.id} scene={story.currentScene} />
          </div>
        </aside>
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
