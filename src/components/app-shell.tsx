import Link from "next/link";
import { BookOpen, Bot, FolderKanban, Leaf, Search, UserRound } from "lucide-react";

const navItems = [
  { href: "/stories", label: "스토리", icon: BookOpen },
  { href: "/characters", label: "캐릭터", icon: Bot },
  { href: "/my", label: "내 작품", icon: FolderKanban },
  { href: "/profile", label: "MY", icon: UserRound }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#fbfdf7] text-ink">
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#e2ead8] bg-white/95 px-4 backdrop-blur">
        <Link href="/stories" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-leaf-300 text-leaf-900">
            <Leaf size={18} />
          </span>
          <span>Lime Archive</span>
        </Link>
        <div className="mx-6 hidden h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-[#dce8d1] bg-[#fbfdf7] px-3 md:flex">
          <Search size={17} className="text-[#7a866f]" />
          <input
            id="global-search"
            name="global_search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#8b9682]"
            placeholder="스토리, 캐릭터, 태그 검색"
          />
        </div>
        <nav className="ml-auto flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-[#425038] hover:bg-leaf-50"
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="grid min-h-[calc(100dvh-56px)] grid-cols-1 md:grid-cols-[76px_1fr]">
        <aside className="hidden border-r border-[#e2ead8] bg-white md:block">
          <div className="sticky top-14 flex h-[calc(100dvh-56px)] flex-col items-center gap-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="grid size-11 place-items-center rounded-xl text-[#526047] hover:bg-leaf-50 hover:text-leaf-900"
                >
                  <Icon size={20} />
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </AppShell>
  );
}
