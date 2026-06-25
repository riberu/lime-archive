"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function StartChatButton({ storyId, scene }: { storyId: string; scene?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const startChat = () => {
    setError("");
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;

      if (!session?.access_token) {
        router.push("/signup");
        return;
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ storyId, scene })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "채팅방을 만들지 못했어요.");
        return;
      }

      const data = (await response.json()) as { id: string };
      router.push(`/chat/${data.id}`);
    });
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <button type="button" className="btn btn-primary" onClick={startChat} disabled={isPending}>
        <MessageCircle size={18} /> {isPending ? "시작 중..." : "채팅 시작"}
      </button>
      {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
