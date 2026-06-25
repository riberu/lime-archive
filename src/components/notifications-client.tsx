"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarCheck, Megaphone } from "lucide-react";
import { getOrCreateUserKey } from "@/lib/user-key";

type NotificationItem = {
  id: string;
  category: "attendance" | "notice" | "system";
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userKey = getOrCreateUserKey();
    void fetch(`/api/notifications?userKey=${encodeURIComponent(userKey)}`)
      .then((response) => response.json())
      .then((data: { notifications: NotificationItem[] }) => setItems(data.notifications))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="empty-card">알림을 불러오는 중입니다.</div>;
  }

  if (!items.length) {
    return <div className="empty-card">아직 새 알림이 없어요.</div>;
  }

  return (
    <div className="set-group">
      <div className="gt">최근 알림</div>
      {items.map((item) => {
        const Icon = item.category === "attendance" ? CalendarCheck : item.category === "notice" ? Megaphone : Bell;
        const body = (
          <div className="set-row items-start">
            <span className="ui-icon-btn ui-icon-btn-active shrink-0">
              <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{item.title}</span>
              <span className="mt-1 block text-sm leading-6 text-[var(--ink-soft)]">{item.body}</span>
              <span className="mt-2 block text-xs text-[var(--ink-faint)]">{new Date(item.createdAt).toLocaleString("ko-KR")}</span>
            </span>
          </div>
        );

        return item.href ? (
          <Link key={item.id} href={item.href}>
            {body}
          </Link>
        ) : (
          <div key={item.id}>{body}</div>
        );
      })}
    </div>
  );
}
