"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function StoryAuthorFollow({
  authorId,
  initialFollowerCount,
  initialFollowing
}: {
  authorId: string;
  initialFollowerCount: number;
  initialFollowing?: boolean;
}) {
  const [token, setToken] = useState("");
  const [following, setFollowing] = useState(Boolean(initialFollowing));
  const [isSelf, setIsSelf] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const accessToken = session?.access_token ?? "";
      setToken(accessToken);
      if (accessToken) await loadStatus(accessToken);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token ?? "";
      setToken(accessToken);
      if (accessToken) void loadStatus(accessToken);
    });

    return () => data.subscription.unsubscribe();
  }, [authorId]);

  const loadStatus = async (accessToken: string) => {
    const response = await fetch(`/api/follows?authorId=${encodeURIComponent(authorId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return;
    const data = (await response.json()) as { following?: boolean; isSelf?: boolean; followerCount?: number };
    setFollowing(Boolean(data.following));
    setIsSelf(Boolean(data.isSelf));
    setFollowerCount(data.followerCount ?? initialFollowerCount);
  };

  const toggleFollow = () => {
    if (!token) {
      window.location.href = "/signup";
      return;
    }

    setError("");
    startTransition(async () => {
      const response = await fetch(following ? `/api/follows?authorId=${encodeURIComponent(authorId)}` : "/api/follows", {
        method: following ? "DELETE" : "POST",
        headers: following ? { Authorization: `Bearer ${token}` } : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: following ? undefined : JSON.stringify({ authorId })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; following?: boolean; followerCount?: number };
      if (!response.ok) {
        setError(data.error ?? "팔로우 상태를 변경하지 못했어요.");
        return;
      }
      setFollowing(Boolean(data.following));
      setFollowerCount(data.followerCount ?? followerCount);
    });
  };

  if (isSelf) {
    return <span className="rounded-full bg-[#ecfccb] px-3 py-1 text-xs font-bold text-[#3f6212]">내 작품</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={following ? "btn btn-ghost" : "btn btn-primary"} onClick={toggleFollow} disabled={isPending}>
        {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
        {following ? "팔로잉" : "팔로우"}
      </button>
      <span className="text-xs font-semibold text-[var(--muted)]">팔로워 {followerCount.toLocaleString("ko-KR")}</span>
      {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
