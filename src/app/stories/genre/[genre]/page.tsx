import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StoryCard, WideStoryCard } from "@/components/content-card";
import { getStories } from "@/lib/data";
import { filterStoriesByGenre, getGenre, genreItems } from "@/lib/genres";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return genreItems.map((genre) => ({ genre: genre.slug }));
}

export default async function GenreStoriesPage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre: slug } = await params;
  const genre = getGenre(slug);
  if (!genre) notFound();

  const stories = await getStories();
  const matchedStories = filterStoriesByGenre(stories, slug);
  const rankedStories = [...matchedStories].sort((a, b) => b.chatCount + b.likeCount - (a.chatCount + a.likeCount)).slice(0, 9);

  return (
    <WorkspaceLayout>
      <section className="wrap pb-16">
        <div className="list-top">
          <div>
            <Link href="/stories" className="back mb-2 mt-0">
              ← 스토리 목록
            </Link>
            <h1>{genre.label}</h1>
            <div className="sub">{genre.label} 분위기에 맞는 스토리를 모았습니다.</div>
          </div>
          <Link href="/create/story" className="btn btn-primary">
            <Plus size={16} /> 이 장르로 만들기
          </Link>
        </div>

        <nav className="gchips" aria-label="장르 목록">
          <Link href="/stories" className="gchip">
            전체
          </Link>
          {genreItems.map((item) => (
            <Link key={item.slug} href={`/stories/genre/${item.slug}`} className={`gchip ${item.slug === slug ? "on" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="shelf">
          <div className="shelf-head">
            <h2>{genre.label} 인기작</h2>
          </div>
          <div className="track">{matchedStories.length ? matchedStories.slice(0, 10).map((story) => <StoryCard key={story.id} story={story} />) : <EmptyGenre label={genre.label} />}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>{genre.label} 베스트</h2>
          </div>
          <div className="best-list">{rankedStories.length ? rankedStories.map((story, index) => <WideStoryCard key={story.id} story={story} rank={index + 1} />) : <p className="empty-line">아직 순위를 만들 작품이 없어요.</p>}</div>
        </section>

        <section className="shelf">
          <div className="shelf-head">
            <h2>전체 스토리</h2>
          </div>
          <div className="grid-cards">{matchedStories.length ? matchedStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyGenre label={genre.label} />}</div>
        </section>
      </section>
    </WorkspaceLayout>
  );
}

function EmptyGenre({ label }: { label: string }) {
  return (
    <Link href="/create/story" className="empty-card">
      아직 {label} 장르의 스토리가 없어요. 첫 작품을 만들어 주세요.
    </Link>
  );
}
