import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { CharacterCard } from "@/components/content-card";
import { getCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

const characterGroups = ["전체", "다정한", "차가운", "장난기", "진지한", "판타지", "현대", "로맨스"];

export default async function CharactersPage() {
  const characters = await getCharacters();
  const popular = characters.slice(0, 10);

  return (
    <WorkspaceLayout>
      <section className="wrap pb-16">
        <div className="list-top">
          <div>
            <h1>캐릭터</h1>
            <div className="sub">분류를 골라 그에 맞는 캐릭터를 만나보세요.</div>
          </div>
          <Link href="/create/character" className="btn btn-primary">
            <Plus size={16} /> 캐릭터 만들기
          </Link>
        </div>

        <nav className="gchips" aria-label="캐릭터 분류">
          {characterGroups.map((group, index) => (
            <Link key={group} href="/characters" className={`gchip ${index === 0 ? "on" : ""}`}>
              {group}
            </Link>
          ))}
        </nav>

        <section className="shelf">
          <div className="shelf-head">
            <h2>인기 캐릭터</h2>
            <span className="more">더 보기</span>
          </div>
          <div className="track">{popular.length ? popular.map((character) => <CharacterCard key={character.id} character={character} />) : <EmptyState />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>추천 캐릭터 베스트</h2>
          </div>
          <div className="best-list">
            {characters.length ? (
              characters.slice(0, 9).map((character, index) => (
                <Link key={character.id} href={`/characters/${character.id}`} className="best">
                  <span className={`rk ${index < 3 ? "top" : ""}`}>{index + 1}</span>
                  <span className="bav" />
                  <span className="bi">
                    <b className="bn">{character.name}</b>
                    <small className="bm">{character.personality || character.description}</small>
                  </span>
                  <span className="star">♡</span>
                </Link>
              ))
            ) : (
              <p className="empty-line">아직 추천할 캐릭터가 없어요.</p>
            )}
          </div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>전체 캐릭터</h2>
            <select className="sortsel" id="character-sort" name="character_sort" defaultValue="popular">
              <option value="popular">인기순</option>
              <option value="chats">채팅순</option>
              <option value="new">신규순</option>
              <option value="name">가나다순</option>
            </select>
          </div>
          <div className="grid-chars">{characters.length ? characters.map((character) => <CharacterCard key={character.id} character={character} />) : <EmptyState />}</div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}

function EmptyState() {
  return (
    <Link href="/create/character" className="empty-card">
      아직 등록된 캐릭터가 없어요. 첫 캐릭터를 만들어 주세요.
    </Link>
  );
}
