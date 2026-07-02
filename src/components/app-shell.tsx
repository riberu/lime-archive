import Link from "next/link";
import { Bell, Heart, Search, UserRound } from "lucide-react";
import { LimeFloatingChat, ThemeToggle, WalletBadge } from "@/components/lime-client-shell";

const navItems = [
  { href: "/stories", label: "스토리" },
  { href: "/characters", label: "캐릭터" },
  { href: "/my", label: "내 작품" },
  { href: "/profile", label: "내 정보" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="ui-topbar sticky top-0 z-30 flex items-center gap-5 px-5">
        <Link href="/" className="ui-logo shrink-0" aria-label="홈으로 이동">
          <span className="ui-logo-mark">L</span>
          <span>라임</span>
        </Link>

        <nav className="ui-nav hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="ui-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ui-search ml-auto hidden h-9 w-[320px] max-w-[32vw] items-center gap-2 px-3 md:flex">
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
          <WalletBadge />
          <ThemeToggle />
          <Link href="/profile" className="ui-avatar-btn" title="MY" aria-label="내 정보">
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
