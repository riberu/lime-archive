import Link from "next/link";
import { Bell, BookOpen, Bot, FolderKanban, Heart, ImageIcon, MessageCircle, MoreHorizontal, Search, UserRound } from "lucide-react";

const navItems = [
  { href: "/stories", label: "스토리", icon: BookOpen },
  { href: "/characters", label: "캐릭터", icon: Bot },
  { href: "/my", label: "내 작품", icon: FolderKanban },
  { href: "/profile", label: "이미지", icon: ImageIcon }
];

const sampleChats = [
  { title: "최근 시작한 이야기", sub: "#001 · 방금 전" },
  { title: "기록 보관소의 문", sub: "#479 · 어제" },
  { title: "계약의 온실", sub: "#023 · 지난 대화" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-[#1f2328]">
      <header className="ui-topbar sticky top-0 z-30 flex items-center gap-7 px-5">
        <Link href="/" className="ui-logo shrink-0" aria-label="홈으로 이동">
          라임
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item, index) => (
            <Link key={item.href} href={item.href} className={`text-sm font-semibold hover:text-[#4d6b00] ${index === 0 ? "text-[#4d6b00]" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ui-search ml-auto hidden h-9 w-[340px] max-w-[38vw] items-center gap-2 px-3 md:flex">
          <Search size={16} className="text-[#8b9199]" />
          <input
            id="global-search"
            name="global_search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#9ca3af]"
            placeholder="검색어를 입력해 주세요"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/favorites" className="ui-icon-btn ui-icon-btn-active" title="마음에 든 작품">
            <Heart size={17} />
          </Link>
          <Link href="/notifications" className="ui-icon-btn relative" title="알림">
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#a3e635]" />
          </Link>
          <Link href="/profile" className="grid size-[30px] place-items-center rounded-full bg-[#4d6b00] text-xs font-bold text-white" title="MY">
            <UserRound size={16} />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
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

          <div className="mb-5 rounded-xl bg-[#ecfccb] p-4 text-center">
            <h2 className="text-sm font-bold">보관함이 비어 있어요</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#6b7280]">채팅 목록을 쉽게 관리할 수 있어요.</p>
            <div className="mt-3 flex gap-2">
              <Link href="/stories" className="flex-1 rounded-lg bg-[#4d6b00] py-2 text-[11px] font-bold text-white">
                탐색
              </Link>
              <Link href="/create/story" className="flex-1 rounded-lg border border-[#ececef] bg-white py-2 text-[11px] font-bold text-[#6b7280]">
                만들기
              </Link>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-[#6b7280]">
            <span>채팅 목록</span>
            <MessageCircle size={14} />
          </div>
          <div className="space-y-1">
            {sampleChats.map((chat) => (
              <div key={chat.title} className="flex items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f7f7f8]">
                <div className="size-[34px] shrink-0 rounded-full bg-[#e7e8ea]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{chat.title}</p>
                  <p className="truncate text-[10.5px] text-[#9ca3af]">{chat.sub}</p>
                </div>
                <MoreHorizontal size={15} className="text-[#9ca3af]" />
              </div>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AppShell>
  );
}
