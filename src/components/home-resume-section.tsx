"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, MessageCircle, Pin } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RecentChat = {
  id: string;
  title: string;
  storyTitle?: string;
  imageUrl?: string;
  imageKind?: "story" | "character";
  updatedAt?: string;
  pinned?: boolean;
};

export function HomeResumeSection() {
  const [items, setItems] = useState<RecentChat[]>([]);
  const [authToken, setAuthToken] = useState("");
  const [ready, setReady] = useState(false);

  const loadSessions = useCallback(async (token: string) => {
    if (!token) {
      setItems([]);
      setReady(true);
      return;
    }

    try {
      const response = await fetch("/api/sessions", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (response.ok ? await response.json() : null) as { sessions?: RecentChat[] } | null;
      setItems((data?.sessions ?? []).slice(0, 6));
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token ?? "";
      setAuthToken(token);
      await loadSessions(token);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? "";
      setAuthToken(token);
      void loadSessions(token);
    });

    return () => data.subscription.unsubscribe();
  }, [loadSessions]);

  if (!ready || !authToken || !items.length) return null;

  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>이어서 대화하기</h2>
        <Link href="/my" className="more">
          보관함 <ChevronRight size={15} />
        </Link>
      </div>
      <div className="track">
        {items.map((chat) => (
          <Link key={chat.id} href={`/chat/${chat.id}`} className="resume">
            <span className="av">
              {chat.imageUrl ? <Image src={chat.imageUrl} alt="" fill sizes="46px" className="object-cover" /> : <MessageCircle size={18} />}
            </span>
            <span className="ri">
              <b className="rn">
                {chat.pinned ? <Pin size={13} aria-label="고정됨" /> : null}
                {chat.title || chat.storyTitle || "새 채팅"}
              </b>
              <small className="rc">
                {chat.storyTitle ? `${chat.storyTitle} · ` : ""}
                {formatDate(chat.updatedAt)}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "최근 대화";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 대화";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
