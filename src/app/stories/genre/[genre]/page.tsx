import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { WorkspaceLayout } from "@/components/app-shell";
import { StoryCard } from "@/components/content-card";
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

  return (
    <WorkspaceLayout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/stories" className="inline-flex items-center gap-2 text-sm font-semibold text-leaf-700">
              <ArrowLeft size={16} /> 스토리 탐색으로
            </Link>
            <p className="mt-5 text-sm font-medium text-leaf-600">Genre</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{genre.label}</h1>
            <p className="mt-2 text-[#66705f]">{genre.label} 태그와 분위기에 맞는 스토리를 모았습니다.</p>
          </div>
          <Link href="/create/story" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
            <Plus size={18} /> 이 장르로 만들기
          </Link>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="장르 목록">
          {genreItems.map((item) => (
            <Link
              key={item.slug}
              href={`/stories/genre/${item.slug}`}
              className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm ${
                item.slug === slug ? "border-leaf-500 bg-leaf-500 text-white" : "border-[#dce8d1] bg-white text-[#526047] hover:bg-leaf-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {matchedStories.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {matchedStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#cad9bd] bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">아직 이 장르의 스토리가 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-[#66705f]">스토리 생성 화면에서 태그에 `{genre.label}`을 넣으면 이 페이지에 표시됩니다.</p>
            <Link href="/create/story" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
              첫 작품 만들기
            </Link>
          </div>
        )}
      </section>
    </WorkspaceLayout>
  );
}
