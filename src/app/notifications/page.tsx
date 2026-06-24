import { AppShell } from "@/components/app-shell";
import { NotificationsClient } from "@/components/notifications-client";

export default function NotificationsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Notifications</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">알림</h1>
          <p className="mt-2 text-[#6b7280]">출석, 공지사항, 시스템 안내를 이곳에서 확인합니다.</p>
        </div>
        <NotificationsClient />
      </main>
    </AppShell>
  );
}
