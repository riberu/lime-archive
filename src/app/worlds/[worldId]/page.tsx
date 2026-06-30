import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { CharacterCard, StoryCard } from "@/components/content-card";
import { getStories, getWorld, getWorldCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WorldPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const [world, characters, stories] = await Promise.all([getWorld(worldId), getWorldCharacters(worldId), getStories()]);
  if (!world) notFound();

  const worldStories = stories.filter((story) => story.worldId === world.id);
  const enabledCharacters = characters.filter((character) => character.isEnabled);

  return (
    <WorkspaceLayout>
      <main className="wrap pb-16">
        <section className="home-hero world-hero">
          <img src={world.imageUrl || "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80"} alt="" className="hh-ph object-cover" />
          <div className="hh-grad" />
          <div className="hh-body">
            <span className="hh-tag">{world.visibility === "public" ? "공개 세계관" : "비공개 세계관"}</span>
            <h1>{world.title}</h1>
            <p>{world.description || "아직 세계관 소개가 없습니다."}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/worlds/${world.id}/characters/new`} className="btn btn-primary">
                <Plus size={16} /> 세계관 캐릭터 만들기
              </Link>
              <Link href={`/create/story?worldId=${world.id}`} className="btn btn-ghost">
                <Plus size={16} /> 이 세계관으로 스토리 만들기
              </Link>
            </div>
          </div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>세계관 캐릭터</h2>
            <span className="more">{enabledCharacters.length}명 사용 중</span>
          </div>
          <div className="grid-chars">
            {characters.length ? characters.map((character) => <CharacterCard key={character.id} character={character} />) : <EmptyWorldItem href={`/worlds/${world.id}/characters/new`} label="아직 등록된 세계관 캐릭터가 없습니다." />}
          </div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>이 세계관의 스토리</h2>
            <Link href={`/create/story?worldId=${world.id}`} className="more">
              만들기
            </Link>
          </div>
          <div className="track">
            {worldStories.length ? worldStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyWorldItem href={`/create/story?worldId=${world.id}`} label="아직 이 세계관으로 만든 스토리가 없습니다." />}
          </div>
        </section>
      </main>
    </WorkspaceLayout>
  );
}

function EmptyWorldItem({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="empty-card">
      {label}
    </Link>
  );
}
