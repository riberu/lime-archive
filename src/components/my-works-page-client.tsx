"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MyWorksManager, type WorkItem } from "@/components/my-works-manager";

export function MyWorksPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.replace("/signup");
        return;
      }

      setToken(session.access_token);
      await loadWorks(session.access_token);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        router.replace("/signup");
        return;
      }
      setToken(session.access_token);
      void loadWorks(session.access_token);
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  const loadWorks = async (accessToken: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/my/works", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (response.status === 401) {
        router.replace("/signup");
        return;
      }

      const data = (await response.json()) as { items?: WorkItem[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "내 작품을 불러오지 못했어요.");
        return;
      }

      setItems(data.items ?? []);
    } catch {
      setError("내 작품을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const removeDeletedItems = (deletedItems: WorkItem[]) => {
    const deletedKeys = new Set(deletedItems.map((item) => `${item.type}:${item.id}`));
    setItems((current) => current.filter((item) => !deletedKeys.has(`${item.type}:${item.id}`)));
  };

  return (
    <section className="wrap pb-16">
      <div className="works-head">
        <h1>내 작품</h1>
        <div className="flex gap-2">
          <Link href="/create/story" className="btn btn-primary">
            <Plus size={16} /> 스토리 만들기
          </Link>
          <Link href="/create/character" className="btn btn-ghost">
            <Plus size={16} /> 캐릭터 만들기
          </Link>
        </div>
      </div>

      <div className="stat-cards">
        <div className="scard accent">
          <div className="n">{items.length}</div>
          <div className="l">전체 작품</div>
        </div>
        <div className="scard">
          <div className="n">{items.filter((item) => item.type === "story").length}</div>
          <div className="l">스토리</div>
        </div>
        <div className="scard">
          <div className="n">{items.filter((item) => item.type === "character").length}</div>
          <div className="l">캐릭터</div>
        </div>
      </div>

      {loading ? <div className="empty-card">내 작품을 불러오는 중입니다.</div> : null}
      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error ? <MyWorksManager items={items} authToken={token} onDeleted={removeDeletedItems} /> : null}
    </section>
  );
}
