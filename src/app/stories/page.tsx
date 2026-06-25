import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StoryCard, WideStoryCard } from "@/components/content-card";
import { getStories } from "@/lib/data";
import { genreItems, getFeaturedStories } from "@/lib/genres";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const stories = await getStories();
  const featuredStories = getFeaturedStories(stories);
  const rankedStories = [...stories].sort((a, b) => b.chatCount + b.likeCount - (a.chatCount + a.likeCount)).slice(0, 12);

  return (
    <WorkspaceLayout>
      <section className="wrap pb-16">
        <div className="list-top">
          <div>
            <h1>스토리</h1>
            <div className="sub">장르를 골라 그 세계의 추천작을 만나보세요.</div>
          </div>
          <Link href="/create/story" className="btn btn-primary">
            <Plus size={16} /> 스토리 만들기
          </Link>
        </div>

        <nav className="gchips" aria-label="스토리 장르">
          <Link href="/stories" className="gchip on">
            전체
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
            <span className="more">더 보기</span>
          </div>
          <div className="track">{featuredStories.length ? featuredStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyState />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>추천 스토리 베스트</h2>
          </div>
          <div className="best-list">{rankedStories.length ? rankedStories.map((story, index) => <WideStoryCard key={story.id} story={story} rank={index + 1} />) : <EmptyLine />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>전체 스토리</h2>
            <select className="sortsel" id="story-sort" name="story_sort" defaultValue="popular">
              <option value="popular">인기순</option>
              <option value="chats">채팅순</option>
              <option value="new">신규순</option>
              <option value="name">가나다순</option>
            </select>
          </div>
          <div className="grid-cards">{stories.length ? stories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyState />}</div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}

function EmptyState() {
  return (
    <Link href="/create/story" className="empty-card">
      아직 등록된 스토리가 없어요. 첫 스토리를 만들어 주세요.
    </Link>
  );
}

function EmptyLine() {
  return <p className="empty-line">아직 순위를 만들 작품이 없어요.</p>;
}
