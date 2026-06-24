import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Medal, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DarkCharacterCard, StoryCard, WideStoryCard } from "@/components/content-card";
import { getCharacters, getStories } from "@/lib/data";
import { genreItems, getFeaturedStories } from "@/lib/genres";

export const dynamic = "force-dynamic";

const fallbackHero = "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80";

export default async function HomePage() {
  const [stories, characters] = await Promise.all([getStories(), getCharacters()]);
  const featuredStories = getFeaturedStories(stories);
  const heroStory = featuredStories[0];
  const newStories = stories.slice(0, 8);
  const rankedStories = featuredStories.slice(0, 8);

  return (
    <AppShell>
      <div className="flex min-h-[calc(100dvh-56px)]">
        <aside className="ui-sidebar sticky top-14 hidden h-[calc(100dvh-56px)] shrink-0 overflow-y-auto px-3 py-4 lg:block">
          <div className="mb-4 flex gap-1">
            <button className="relative flex-1 py-2 text-sm font-bold text-[#1f2328] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#4d6b00]">
              에피소드
            </button>
            <button className="flex-1 py-2 text-sm font-bold text-[#9ca3af]">노트</button>
          </div>
          <div className="rounded-xl bg-[#ecfccb] p-4 text-center">
            <h2 className="text-sm font-bold">아직 보관함이 비어 있어요</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#6b7280]">스토리를 시작하면 최근 채팅이 이곳에 쌓입니다.</p>
            <div className="mt-3 flex gap-2">
              <Link href="/stories" className="flex-1 rounded-lg bg-[#4d6b00] py-2 text-[11px] font-bold text-white">탐색</Link>
              <Link href="/create/story" className="flex-1 rounded-lg border border-[#ececef] bg-white py-2 text-[11px] font-bold text-[#6b7280]">만들기</Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-[18px] pb-16 md:px-7">
          <div className="mx-auto max-w-[1060px]">
            <nav className="mb-[18px] flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="홈 장르">
              <Link href="/stories" className="ui-chip ui-chip-active">추천</Link>
              <Link href="/stories#new" className="ui-chip">오늘 신작</Link>
              <Link href="/stories" className="ui-chip">전체 랭킹</Link>
              {genreItems.map((genre) => (
                <Link key={genre.slug} href={`/stories/genre/${genre.slug}`} className="ui-chip">
                  {genre.label}
                </Link>
              ))}
            </nav>

            <section className="mb-[18px] flex gap-3">
              <Link href={heroStory ? `/stories/${heroStory.id}` : "/create/story"} className="ui-hero relative flex flex-1 items-end">
                <Image src={heroStory?.thumbnailUrl || fallbackHero} alt="" fill priority className="absolute inset-0 object-cover" />
                <div className="ui-hero-grad absolute inset-0" />
                <span className="absolute right-4 top-3 rounded-full bg-black/40 px-3 py-1 text-[11px]">1 / {Math.max(stories.length, 1)}</span>
                <div className="relative max-w-[640px] p-6">
                  <span className="ui-tag-pill mb-3">스토리 추천</span>
                  <h1 className="mb-2 text-2xl font-extrabold leading-tight md:text-[28px]">
                    {heroStory?.title || "첫 스토리를 등록해 보세요"}
                  </h1>
                  <p className="mb-2 max-w-xl text-sm leading-6 text-[#d7dade]">
                    {heroStory?.description || "등록된 작품이 아직 없습니다. 긴 폼 제작 페이지에서 세계관과 오프닝을 입력하면 홈에 바로 표시됩니다."}
                  </p>
                  <p className="mb-4 text-xs text-[#aeb2b8]">{heroStory?.tags.map((tag) => `#${tag}`).join(" ") || "#첫작품 #라임"}</p>
                  <span className="inline-flex rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-xs font-semibold">자세히 보기</span>
                </div>
                <span className="absolute right-4 top-1/2 grid size-[34px] -translate-y-1/2 place-items-center rounded-full bg-white/20">
                  <ChevronRight size={18} />
                </span>
              </Link>
              <div className="hidden w-[92px] shrink-0 flex-col gap-3 md:flex">
                <div className="flex-1 rounded-[14px] bg-[#e7e8ea]" />
                <div className="flex-1 rounded-[14px] bg-[#e7e8ea]" />
              </div>
            </section>

            <section className="mb-4 grid gap-3 md:grid-cols-2">
              <Link href="/create/story" className="flex items-center justify-between rounded-[14px] bg-[#f7f7f8] px-5 py-[18px]">
                <div>
                  <p className="mb-1 text-xs text-[#6b7280]">세계관을 길게 관리하는</p>
                  <h2 className="text-base font-extrabold text-[#4d6b00]">스토리 제작실</h2>
                </div>
                <div className="h-12 w-16 rounded-[10px] bg-[#e7e8ea]" />
              </Link>
              <Link href="/create/character" className="flex items-center justify-between rounded-[14px] bg-[#f7f7f8] px-5 py-[18px]">
                <div>
                  <p className="mb-1 text-xs text-[#6b7280]">말투와 첫 메시지를 담는</p>
                  <h2 className="text-base font-extrabold text-[#4d6b00]">캐릭터 제작실</h2>
                </div>
                <div className="h-12 w-16 rounded-[10px] bg-[#e7e8ea]" />
              </Link>
            </section>

            <Link href="/my" className="mb-4 flex items-center gap-3 rounded-[14px] bg-[#2a2d33] px-5 py-[18px] text-white">
              <span className="grid size-10 place-items-center rounded-[10px] bg-[#a3e635] text-[#1a2e05]"><Medal size={20} /></span>
              <span>
                <span className="block text-[11px] text-[#b9bdc3]">오늘의 미션</span>
                <span className="block text-[15px] font-extrabold">내 작품 하나 등록하고 DB에 저장하기</span>
              </span>
              <ChevronRight className="ml-auto text-[#b9bdc3]" size={18} />
            </Link>

            <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#ecfccb] px-4 py-3 text-sm font-semibold text-[#3f6212]">
              라임은 이제 등록된 DB 작품을 홈과 탐색 화면에 표시합니다.
              <X className="ml-auto text-[#9ca3af]" size={15} />
            </div>

            <Shelf title="취향을 위한 추천" sub="등록된 스토리 중 반응이 좋은 작품">
              {featuredStories.length ? featuredStories.slice(0, 10).map((story) => <StoryCard key={story.id} story={story} />) : <EmptyShelf />}
            </Shelf>

            <Shelf title="실시간 랭킹" sub="채팅과 좋아요가 많은 작품">
              {rankedStories.length ? rankedStories.slice(0, 8).map((story, index) => <WideStoryCard key={story.id} story={story} rank={index + 1} />) : <EmptyShelf />}
            </Shelf>

            <section className="ui-dark-panel mt-8 px-6 py-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="ui-shelf-title text-white">지금 대화할 수 있는 캐릭터</h2>
                  <p className="ui-shelf-sub mt-1 text-[#9498a1]">말풍선을 눌러 바로 시작해요</p>
                </div>
                <Link href="/characters" className="text-sm font-bold text-[#9498a1]">더 보기</Link>
              </div>
              <div className="ui-track">
                {characters.length ? characters.slice(0, 10).map((character) => <DarkCharacterCard key={character.id} character={character} />) : <EmptyDarkShelf />}
              </div>
            </section>

            <Shelf title="오늘 올라온 신작" sub="최근 등록된 이야기">
              {newStories.length ? newStories.map((story) => <StoryCard key={story.id} story={story} />) : <EmptyShelf />}
            </Shelf>

            <Link href="/stories" className="mt-8 block rounded-xl bg-[#f7f7f8] p-4 text-center text-sm font-bold text-[#6b7280] hover:bg-[#ecfccb] hover:text-[#3f6212]">
              전체 보기
            </Link>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

function Shelf({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="pt-9">
      <div className="mb-[18px] flex items-end justify-between">
        <div>
          <h2 className="ui-shelf-title">{title}</h2>
          <p className="ui-shelf-sub mt-1">{sub}</p>
        </div>
        <Link href="/stories" className="text-sm font-bold text-[#6b7280] hover:text-[#4d6b00]">더 보기</Link>
      </div>
      <div className="ui-track">{children}</div>
    </section>
  );
}

function EmptyShelf() {
  return (
    <Link href="/create/story" className="ui-panel-card flex min-h-[160px] min-w-[288px] items-center justify-center px-6 text-center text-sm font-semibold text-[#6b7280]">
      아직 등록된 작품이 없습니다. 첫 작품을 만들어 주세요.
    </Link>
  );
}

function EmptyDarkShelf() {
  return (
    <Link href="/create/character" className="ui-character-card flex min-h-[180px] items-center justify-center p-5 text-center text-sm font-semibold text-[#c9ced6]">
      아직 등록된 캐릭터가 없습니다.
    </Link>
  );
}
