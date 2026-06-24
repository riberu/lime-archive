"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Heart } from "lucide-react";

export function StoryLikeButton({ storyId, initialLikeCount }: { storyId: string; initialLikeCount: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isPending, startTransition] = useTransition();
  const userKey = useMemo(() => getOrCreateUserKey(), []);

  useEffect(() => {
    if (!userKey) return;
    void fetch(`/api/stories/${storyId}/like?userKey=${encodeURIComponent(userKey)}`)
      .then((response) => response.json())
      .then((data: { liked?: boolean }) => setLiked(Boolean(data.liked)))
      .catch(() => undefined);
  }, [storyId, userKey]);

  const toggle = () => {
    if (!userKey) return;

    startTransition(async () => {
      const response = await fetch(`/api/stories/${storyId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey })
      });

      if (!response.ok) return;

      const data = (await response.json()) as { liked: boolean; likeCount: number };
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={toggle}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
        liked ? "border-leaf-500 bg-leaf-50 text-leaf-900" : "border-[#dce8d1]"
      }`}
    >
      <Heart size={17} fill={liked ? "currentColor" : "none"} /> {likeCount}
    </button>
  );
}

function getOrCreateUserKey() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem("lime-user-key");
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.localStorage.setItem("lime-user-key", next);
  return next;
}
