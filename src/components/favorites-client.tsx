"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Heart, Library } from "lucide-react";
import { CharacterCard, StoryCard } from "@/components/content-card";
import { getOrCreateUserKey } from "@/lib/user-key";
import type { Character, Story } from "@/lib/types";

type FavoriteResponse = {
  stories: Story[];
  characters: Character[];
};

export function FavoritesClient() {
  const [tab, setTab] = useState<"stories" | "characters">("stories");
  const [data, setData] = useState<FavoriteResponse>({ stories: [], characters: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userKey = getOrCreateUserKey();
    void fetch(`/api/favorites?userKey=${encodeURIComponent(userKey)}`)
      .then((response) => response.json())
      .then((next: FavoriteResponse) => setData(next))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button onClick={() => setTab("stories")} className={`ui-chip inline-flex items-center gap-2 ${tab === "stories" ? "ui-chip-active" : ""}`}>
          <Library size={15} /> 스토리
        </button>
        <button onClick={() => setTab("characters")} className={`ui-chip inline-flex items-center gap-2 ${tab === "characters" ? "ui-chip-active" : ""}`}>
          <Bot size={15} /> 캐릭터
        </button>
      </div>

      {loading ? (
        <div className="ui-panel-card p-8 text-center text-sm font-semibold text-[#6b7280]">관심 목록을 불러오는 중입니다.</div>
      ) : tab === "stories" ? (
        data.stories.length ? (
          <div className="ui-track">{data.stories.map((story) => <StoryCard key={story.id} story={story} />)}</div>
        ) : (
          <EmptyFavorites href="/stories" />
        )
      ) : data.characters.length ? (
        <div className="grid gap-4 md:grid-cols-2">{data.characters.map((character) => <CharacterCard key={character.id} character={character} />)}</div>
      ) : (
        <EmptyFavorites href="/characters" />
      )}
    </div>
  );
}

function EmptyFavorites({ href }: { href: string }) {
  return (
    <Link href={href} className="ui-panel-card flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Heart size={26} className="text-[#4d6b00]" />
      <span className="text-sm font-semibold text-[#6b7280]">아직 마음에 든 작품이 없습니다.</span>
    </Link>
  );
}
