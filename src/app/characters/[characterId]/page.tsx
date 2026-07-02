import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceLayout } from "@/components/app-shell";
import { getCharacter, getCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export default async function CharacterDetailPage({
  params
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const [character, allCharacters] = await Promise.all([getCharacter(characterId), getCharacters()]);
  if (!character) notFound();
  if (character.storyId || (character.scope && character.scope !== "independent")) notFound();

  const similar = allCharacters.filter((item) => item.id !== character.id).slice(0, 8);
  const tags = character.personality ? character.personality.split(/[,\s#]+/).filter(Boolean).slice(0, 4) : ["캐릭터", "대화"];

  return (
    <WorkspaceLayout>
      <section className="wrap pb-16">
        <Link href="/characters" className="back">
          ← 캐릭터 목록
        </Link>

        <div className="char-hero">
          <div className="big-av relative overflow-hidden">
            <Image src={character.avatarUrl || fallbackCharacterImage} alt={character.name} fill priority suppressHydrationWarning className="object-cover" />
          </div>
          <h1>{character.name}</h1>
          <div className="maker">제작 · 라임 크리에이터</div>
          <div className="ctags">
            {tags.map((tag) => (
              <span key={tag} className="ctag">
                #{tag}
              </span>
            ))}
          </div>
          <div className="cstats">
            <div>
              <div className="n">대화</div>
              <div className="l">바로 시작</div>
            </div>
            <div>
              <div className="n">공개</div>
              <div className="l">상태</div>
            </div>
            <div>
              <div className="n">AI</div>
              <div className="l">롤플레잉</div>
            </div>
          </div>
          <p className="locked-note">독립 캐릭터 채팅은 다음 단계에서 연결됩니다.</p>
        </div>

        <div className="chat-preview">
          <div className="pv-label">미리보기</div>
          <div className="msg">
            <div className="av" />
            <div className="bubble">{character.firstMessage || "안녕, 오늘은 무슨 이야기를 들려줄래?"}</div>
          </div>
          <div className="msg me">
            <div className="bubble">너에 대해 알고 싶어.</div>
          </div>
          <div className="msg">
            <div className="av" />
            <div className="bubble">{character.speechStyle || "좋아. 천천히 말해줄게. 어떤 부분부터 궁금해?"}</div>
          </div>
        </div>

        <div className="char-desc">
          <h3>캐릭터 소개</h3>
          <p>{character.description}</p>
        </div>

        <div className="char-desc">
          <h3>성격과 말투</h3>
          <p>{character.personality || "아직 성격 설명이 없습니다."}</p>
          <p className="mt-4">{character.speechStyle || "아직 말투 설명이 없습니다."}</p>
        </div>

        <h2 className="section-title">비슷한 캐릭터</h2>
        <div className="sim-track">
          {similar.length ? (
            similar.map((item) => (
              <Link key={item.id} href={`/characters/${item.id}`} className="sim">
                <span className="av relative block overflow-hidden">
                  {item.avatarUrl ? <Image src={item.avatarUrl} alt={item.name} fill suppressHydrationWarning className="object-cover" /> : null}
                </span>
                <b className="nm">{item.name}</b>
                <small className="ds">{item.personality || "캐릭터"}</small>
              </Link>
            ))
          ) : (
            <p className="empty-line">비슷한 캐릭터가 아직 없어요.</p>
          )}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
