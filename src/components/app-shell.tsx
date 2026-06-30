import Link from "next/link";
import { Bell, BookOpen, Bot, FolderKanban, Heart, Search, UserRound } from "lucide-react";
import { LimeFloatingChat, ThemeToggle } from "@/components/lime-client-shell";

const navItems = [
  { href: "/stories", label: "스토리", icon: BookOpen },
  { href: "/characters", label: "캐릭터", icon: Bot },
  { href: "/my", label: "보관함", icon: FolderKanban },
  { href: "/profile", label: "내 정보", icon: UserRound }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="ui-topbar sticky top-0 z-30 flex items-center gap-6 px-5">
        <Link href="/" className="ui-logo shrink-0" aria-label="홈으로 이동">
          라임
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent-strong)]">
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ui-search ml-auto hidden h-9 w-[340px] max-w-[34vw] items-center gap-2 px-3 md:flex">
          <Search size={16} className="text-[#8b9199]" />
          <input id="global-search" name="global_search" className="w-full bg-transparent text-sm outline-none placeholder:text-[#9ca3af]" placeholder="스토리, 캐릭터, 태그 검색" />
        </div>

        <div className="flex items-center gap-2">
          <Link href="/favorites" className="ui-icon-btn ui-icon-btn-active" title="마음에 든 작품" aria-label="마음에 든 작품">
            <Heart size={17} />
          </Link>
          <Link href="/notifications" className="ui-icon-btn relative" title="알림" aria-label="알림">
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#a3e635]" />
          </Link>
          <ThemeToggle />
          <Link href="/profile" className="grid size-[30px] place-items-center rounded-full bg-[var(--accent-strong)] text-xs font-bold text-white" title="MY" aria-label="내 정보">
            <UserRound size={16} />
          </Link>
        </div>
      </header>
      {children}
      <LimeFloatingChat />
    </div>
  );
}

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <main className="min-h-[calc(100dvh-56px)]">{children}</main>
    </AppShell>
  );
}
