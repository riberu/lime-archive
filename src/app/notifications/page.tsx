import { AppShell } from "@/components/app-shell";
import { NotificationsClient } from "@/components/notifications-client";

export default function NotificationsPage() {
  return (
    <AppShell>
      <main className="wrap pb-16">
        <div className="list-top">
          <div>
            <h1>알림</h1>
            <div className="sub">출석, 공지사항, 시스템 안내를 이곳에서 확인합니다.</div>
          </div>
        </div>
        <section className="shelf">
          <NotificationsClient />
        </section>
      </main>
    </AppShell>
  );
}
