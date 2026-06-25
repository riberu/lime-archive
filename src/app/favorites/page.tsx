import { AppShell } from "@/components/app-shell";
import { FavoritesClient } from "@/components/favorites-client";

export default function FavoritesPage() {
  return (
    <AppShell>
      <main className="wrap pb-16">
        <div className="list-top">
          <div>
            <h1>마음에 든 작품</h1>
            <div className="sub">좋아요를 누른 스토리와 캐릭터를 따로 모아봅니다.</div>
          </div>
        </div>
        <section className="shelf">
          <FavoritesClient />
        </section>
      </main>
    </AppShell>
  );
}
