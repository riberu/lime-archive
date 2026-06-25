import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2 } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { PersonaTemplateText } from "@/components/persona-template-text";
import { StartChatButton } from "@/components/start-chat-button";
import { StoryAuthorFollow } from "@/components/story-author-follow";
import { StoryLikeButton } from "@/components/story-like-button";
import { getAuthorProfile } from "@/lib/authors";
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
  const author = await getAuthorProfile(story.creatorId);
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <WorkspaceLayout>
      <section className="wrap pb-16">
        <Link href="/stories" className="back">
          스토리 목록
        </Link>

        <div className="story-top">
          <div className="story-cover">
            <Image src={imageSrc} alt={story.title} fill priority suppressHydrationWarning className="object-cover" />
            <div className="spine" />
          </div>
          <div className="story-info">
            <span className="s-badge">ORIGINAL</span>
            <h1>{story.title}</h1>
            <div className="author">공개 작품 · {new Date(story.createdAt).toLocaleDateString("ko-KR")}</div>
            {author ? (
              <div className="author-card">
                <div className="author-avatar">
                  {author.avatarUrl ? <Image src={author.avatarUrl} alt="" fill suppressHydrationWarning className="object-cover" /> : <span>{author.displayName.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="author-meta">
                  <b>{author.displayName}</b>
                  <small>{author.bio || "이 작품을 만든 작가입니다."}</small>
                </div>
                <StoryAuthorFollow authorId={author.id} initialFollowerCount={author.followerCount} />
              </div>
            ) : null}
            <div className="tag-row">
              {story.tags.length ? story.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>) : <span className="tag">#스토리</span>}
            </div>
            <div className="stat-row">
              <div className="item"><div className="n">{story.chatCount.toLocaleString("ko-KR")}</div><div className="l">대화</div></div>
              <div className="item"><div className="n">{story.likeCount.toLocaleString("ko-KR")}</div><div className="l">좋아요</div></div>
              <div className="item"><div className="n">{characters.length}</div><div className="l">등장인물</div></div>
            </div>
            <p className="synopsis">{story.description}</p>
            <div className="cta-row">
              <StartChatButton storyId={story.id} scene={story.currentScene} />
              <StoryLikeButton storyId={story.id} initialLikeCount={story.likeCount} />
              <button type="button" className="btn btn-ghost">
                <Share2 size={16} /> 공유
              </button>
            </div>
          </div>
        </div>

        <div className="story-tabs">
          <button className="on" type="button">등장인물</button>
          <button type="button">세계관</button>
          <button type="button">1화 미리보기</button>
        </div>

        <section className="story-tab on">
          <div className="cast-grid">
            {characters.length ? (
              characters.map((character) => (
                <Link key={character.id} href={`/characters/${character.id}`} className="cast">
                  <span className="av relative overflow-hidden">
                    {character.avatarUrl ? <Image src={character.avatarUrl} alt={character.name} fill suppressHydrationWarning className="object-cover" /> : null}
                  </span>
                  <span className="ci">
                    <span className="role">등장인물</span>
                    <b className="nm">{character.name}</b>
                    <span className="ds">{character.description}</span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="empty-line">아직 연결된 캐릭터가 없어요.</p>
            )}
          </div>
        </section>

        <section className="world-block">
          <h3>배경</h3>
          <PersonaTemplateText text={story.currentScene} fallback="이야기가 시작되는 장면과 분위기가 여기에 표시됩니다." />
        </section>

        <section className="world-block">
          <h3>설정 · 규칙</h3>
          <PersonaTemplateText text={story.systemPrompt} />
        </section>

        <section className="preview-scene">
          <div className="scene-label">1화 · 이야기의 시작</div>
          <PersonaTemplateText
            className="narration"
            text={story.openingMessage}
            fallback="첫 장면이 시작되면 여기에 설정을 바탕으로 대화가 이어집니다."
          />
          <div className="scene-fade">
            <p>다음은 사용자의 선택과 유저 노트에 따라 이어집니다.</p>
            <StartChatButton storyId={story.id} scene={story.currentScene} />
          </div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}
