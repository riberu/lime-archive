import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MessageCircle, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CharacterCard, StoryCard, WideStoryCard } from "@/components/content-card";
import { HomeResumeSection } from "@/components/home-resume-section";
import { getCharacters, getStories } from "@/lib/data";
import { genreItems, getFeaturedStories } from "@/lib/genres";

export const dynamic = "force-dynamic";

const fallbackHero = "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80";

export default async function HomePage() {
  const [stories, characters] = await Promise.all([getStories(), getCharacters()]);
  const featuredStories = getFeaturedStories(stories);
  const heroStory = featuredStories[0] ?? stories[0];
  const rankedStories = [...stories].sort((a, b) => b.chatCount + b.likeCount - (a.chatCount + a.likeCount)).slice(0, 9);
  const newStories = stories.slice(0, 10);

  return (
    <AppShell>
      <main className="wrap pb-16">
        <section className="home-hero">
          <Image src={heroStory?.thumbnailUrl || fallbackHero} alt="" fill priority suppressHydrationWarning className="hh-ph object-cover" />
          <div className="hh-grad" />
          <div className="hh-body">
            <span className="hh-tag">이번 주의 이야기</span>
            <h1>{heroStory?.title || "라임에서 첫 이야기를 시작해 보세요"}</h1>
            <p>{heroStory?.description || "마음에 드는 세계관을 고르고, 캐릭터와 함께 바로 롤플레잉 대화를 시작할 수 있어요."}</p>
            <div className="hh-actions">
              <Link href={heroStory ? `/stories/${heroStory.id}` : "/stories"} className="btn btn-primary">
                지금 시작하기
              </Link>
              <Link href="/create/story" className="btn btn-glass">
                스토리 만들기
              </Link>
            </div>
          </div>
        </section>

        <HomeResumeSection />

        <nav className="gchips static mt-5" aria-label="장르 바로가기">
          <Link href="/stories" className="gchip on">
            추천
          </Link>
          {genreItems.map((genre) => (
            <Link key={genre.slug} href={`/stories/genre/${genre.slug}`} className="gchip">
              {genre.label}
            </Link>
          ))}
        </nav>

        <section className="shelf">
          <div className="shelf-head">
            <h2>인기 스토리</h2>
            <Link href="/stories" className="more">
              더 보기 <ChevronRight size={15} />
            </Link>
          </div>
          <div className="track">{featuredStories.length ? featuredStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyStory />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>추천 스토리 베스트</h2>
            <Link href="/stories" className="more">
              전체 <ChevronRight size={15} />
            </Link>
          </div>
          <div className="best-list">{rankedStories.length ? rankedStories.map((story, index) => <WideStoryCard key={story.id} story={story} rank={index + 1} />) : <EmptyText />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>인기 캐릭터</h2>
            <Link href="/characters" className="more">
              더 보기 <ChevronRight size={15} />
            </Link>
          </div>
          <div className="track">{characters.length ? characters.slice(0, 10).map((character) => <CharacterCard key={character.id} character={character} />) : <EmptyCharacter />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>오늘 올라온 신작</h2>
            <Link href="/create/story" className="more">
              <Plus size={15} /> 만들기
            </Link>
          </div>
          <div className="track">{newStories.length ? newStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyStory />}</div>
        </section>
      </main>
    </AppShell>
  );
}

function EmptyStory() {
  return (
    <Link href="/create/story" className="empty-card">
      <Sparkles size={20} /> 아직 등록된 스토리가 없어요. 첫 작품을 만들어 주세요.
    </Link>
  );
}

function EmptyCharacter() {
  return (
    <Link href="/create/character" className="empty-card">
      <MessageCircle size={20} /> 아직 등록된 캐릭터가 없어요. 첫 캐릭터를 만들어 주세요.
    </Link>
  );
}

function EmptyText() {
  return <p className="empty-line">아직 보여줄 작품이 없어요.</p>;
}
