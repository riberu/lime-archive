"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

export function StartChatButton({ storyId, scene }: { storyId: string; scene?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const startChat = async () => {
    setStarting(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, scene })
      });
      const data = (await response.json()) as { id?: string };
      if (data.id) router.push(`/chat/${data.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={starting}
      onClick={() => void startChat()}
      className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-leaf-500 font-semibold text-white hover:bg-leaf-600 disabled:opacity-50"
    >
      <MessageCircle size={18} /> {starting ? "채팅방 생성 중..." : "채팅 시작"}
    </button>
  );
}
