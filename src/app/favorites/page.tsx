import { AppShell } from "@/components/app-shell";
import { FavoritesClient } from "@/components/favorites-client";

export default function FavoritesPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Favorite Library</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">마음에 든 작품</h1>
          <p className="mt-2 text-[#6b7280]">하트를 누른 스토리와 캐릭터를 따로 모아봅니다.</p>
        </div>
        <FavoritesClient />
      </main>
    </AppShell>
  );
}
