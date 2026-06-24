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
    return <div className="ui-panel-card p-8 text-center text-sm font-semibold text-[#6b7280]">알림을 불러오는 중입니다.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.category === "attendance" ? CalendarCheck : item.category === "notice" ? Megaphone : Bell;
        const body = (
          <div className="ui-panel-card flex gap-4 p-4 hover:bg-[#f7f7f8]">
            <span className="ui-icon-btn ui-icon-btn-active shrink-0">
              <Icon size={17} />
            </span>
            <span>
              <span className="block font-bold">{item.title}</span>
              <span className="mt-1 block text-sm leading-6 text-[#6b7280]">{item.body}</span>
              <span className="mt-2 block text-xs text-[#9ca3af]">{new Date(item.createdAt).toLocaleString("ko-KR")}</span>
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
