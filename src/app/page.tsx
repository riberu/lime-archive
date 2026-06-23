import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Bot, MessageCircle, PenLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StoryCard } from "@/components/content-card";
import { getCharacters, getStories } from "@/lib/data";
import { genreItems, getFeaturedStories } from "@/lib/genres";

export const dynamic = "force-dynamic";

const heroImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1600&q=80";

const workflow = [
  {
    title: "세계관 선택",
    description: "추천 스토리와 장르별 작품을 둘러보고 원하는 분위기의 채팅을 엽니다.",
    icon: BookOpen
  },
  {
    title: "대화 설정 작성",
    description: "유저 노트에 내 역할, 외모, 기억해야 할 지침을 저장합니다.",
    icon: PenLine
  },
  {
    title: "GM과 이어가기",
    description: "시스템 프롬프트와 유저 노트를 합쳐 장면이 멈추지 않도록 이어갑니다.",
    icon: MessageCircle
  }
];

export default async function HomePage() {
  const [stories, characters] = await Promise.all([getStories(), getCharacters()]);
  const featuredStories = getFeaturedStories(stories).slice(0, 4);
  const featuredStory = featuredStories[0];

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 md:py-12">
        <section className="relative isolate min-h-[520px] overflow-hidden rounded-lg bg-[#13200f] px-5 py-10 text-white md:px-10">
          <Image src={featuredStory?.thumbnailUrl || heroImage} alt="" fill priority className="absolute inset-0 -z-20 object-cover opacity-55" />
          <div className="absolute inset-0 -z-10 bg-black/35" />
          <div className="flex min-h-[440px] max-w-3xl flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-sm backdrop-blur">
              <Sparkles size={16} />
              스토리 롤플레잉 AI 채팅
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-6xl">
              Lime Archive
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/85">
              세계관, 캐릭터, 유저 노트를 한 번에 엮어 장면이 계속 전개되는 개인 롤플레잉 채팅을 만듭니다.
              제작자는 긴 폼으로 작품을 만들고, 사용자는 채팅 중에도 대화 설정을 바로 고칠 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/stories" className="inline-flex h-11 items-center gap-2 rounded-lg bg-leaf-500 px-5 font-semibold text-white hover:bg-leaf-600">
                스토리 탐색 <ArrowRight size={18} />
              </Link>
              <Link href="/create/story" className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-5 font-semibold text-white backdrop-blur hover:bg-white/25">
                작품 만들기
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {workflow.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-[#e0ead4] bg-white p-5">
                <div className="grid size-11 place-items-center rounded-lg bg-leaf-50 text-leaf-700">
                  <Icon size={21} />
                </div>
                <h2 className="mt-4 font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#66705f]">{item.description}</p>
              </div>
            );
          })}
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-leaf-600">Library</p>
              <h2 className="mt-1 text-2xl font-semibold">추천 스토리</h2>
            </div>
            <Link href="/stories" className="text-sm font-semibold text-leaf-700">전체 보기</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {featuredStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-sm font-medium text-leaf-600">Genres</p>
            <h2 className="mt-1 text-2xl font-semibold">장르별로 찾기</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {genreItems.map((genre) => (
              <Link key={genre.slug} href={`/stories/genre/${genre.slug}`} className="rounded-lg border border-[#e0ead4] bg-white p-4 hover:border-leaf-400 hover:bg-leaf-50">
                <span className="font-semibold">{genre.label}</span>
                <p className="mt-2 text-sm leading-6 text-[#66705f]">이 장르의 스토리를 모아봅니다.</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#e0ead4] bg-white p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-leaf-600">Character Studio</p>
              <h2 className="mt-1 text-2xl font-semibold">캐릭터를 만들고 스토리에 연결</h2>
              <p className="mt-2 text-sm leading-6 text-[#66705f]">
                캐릭터는 독립적으로 관리하고, 스토리 제작 화면에서 등장 인물로 연결할 수 있게 설계했습니다.
              </p>
            </div>
            <Link href="/create/character" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#dce8d1] px-4 text-sm font-semibold hover:bg-leaf-50">
              <Bot size={18} /> 캐릭터 만들기
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {characters.slice(0, 2).map((character) => (
              <Link key={character.id} href={`/characters/${character.id}`} className="rounded-lg bg-[#fbfdf7] p-4 hover:bg-leaf-50">
                <h3 className="font-semibold">{character.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#66705f]">{character.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
