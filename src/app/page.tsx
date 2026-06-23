import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Bot, MessageCircle, PenLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StoryCard } from "@/components/content-card";
import { demoCharacters, demoStories } from "@/lib/mock-data";

const workflow = [
  {
    title: "세계관을 고르기",
    description: "추천 스토리와 캐릭터를 둘러보고 원하는 장르의 작품을 엽니다.",
    icon: BookOpen
  },
  {
    title: "대화 설정 작성",
    description: "유저 노트에 역할, 외모, 기억해야 할 지침을 저장합니다.",
    icon: PenLine
  },
  {
    title: "GM과 이어 쓰기",
    description: "Gemini가 세계관과 유저 노트를 합쳐 능동적으로 사건을 전개합니다.",
    icon: MessageCircle
  }
];

export default function HomePage() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 md:py-12">
        <section className="grid min-h-[520px] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce8d1] bg-white px-3 py-1 text-sm text-[#526047]">
              <Sparkles size={16} className="text-leaf-600" />
              스토리 롤플레잉 AI 채팅
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              세계관을 열고,
              <br />
              대화를 이어 쓰세요.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#5f6d55]">
              스토리, 등장인물, 유저 노트를 하나의 지시문으로 묶어 장면이 멈추지 않는 롤플레잉 채팅을 만듭니다.
              제작자는 긴 폼으로 세계관을 관리하고, 사용자는 채팅 중에도 설정을 수정할 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/stories" className="inline-flex h-11 items-center gap-2 rounded-lg bg-leaf-500 px-5 font-semibold text-white hover:bg-leaf-600">
                스토리 시작 <ArrowRight size={18} />
              </Link>
              <Link href="/create/story" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dce8d1] bg-white px-5 font-semibold hover:bg-leaf-50">
                작품 만들기
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-[#dce8d1] bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-leaf-50">
                <Image
                  src={demoStories[0].thumbnailUrl}
                  alt={demoStories[0].title}
                  fill
                  priority
                  className="object-cover"
                />
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-leaf-600">Featured Story</p>
                    <h2 className="mt-1 text-xl font-semibold">{demoStories[0].title}</h2>
                  </div>
                  <span className="rounded-full bg-leaf-50 px-3 py-1 text-sm text-leaf-900">LIVE</span>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-[#66705f]">{demoStories[0].description}</p>
                <div className="rounded-xl bg-[#fbfdf7] p-4">
                  <p className="text-xs font-semibold text-[#7a866f]">USER NOTE</p>
                  <p className="mt-2 text-sm leading-6 text-[#425038]">
                    나는 DMA 신규 등록자. 낯선 용의 세계를 두려워하지만, 사건의 중심에서 물러서지 않는다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {workflow.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-[#e0ead4] bg-white p-5">
                <div className="grid size-11 place-items-center rounded-lg bg-leaf-50 text-leaf-700">
                  <Icon size={21} />
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
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
          <div className="grid gap-5 md:grid-cols-2">
            {demoStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e0ead4] bg-white p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-leaf-600">Character Studio</p>
              <h2 className="mt-1 text-2xl font-semibold">캐릭터를 독립 생성하고 스토리에 연결</h2>
              <p className="mt-2 text-sm leading-6 text-[#66705f]">
                캐릭터는 단독으로 관리하고, 스토리 생성 페이지에서 등장인물로 연결할 수 있게 설계했습니다.
              </p>
            </div>
            <Link href="/create/character" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#dce8d1] px-4 text-sm font-semibold hover:bg-leaf-50">
              <Bot size={18} /> 캐릭터 만들기
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {demoCharacters.map((character) => (
              <div key={character.id} className="rounded-lg bg-[#fbfdf7] p-4">
                <h3 className="font-semibold">{character.name}</h3>
                <p className="mt-1 text-sm leading-6 text-[#66705f]">{character.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
