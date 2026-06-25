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
    <div>
      <div className="work-tabs">
        <button type="button" onClick={() => setTab("stories")} className={tab === "stories" ? "on" : ""}>
          <Library size={15} /> 스토리
        </button>
        <button type="button" onClick={() => setTab("characters")} className={tab === "characters" ? "on" : ""}>
          <Bot size={15} /> 캐릭터
        </button>
      </div>

      {loading ? (
        <div className="empty-card">관심 목록을 불러오는 중입니다.</div>
      ) : tab === "stories" ? (
        data.stories.length ? (
          <div className="track">{data.stories.map((story) => <StoryCard key={story.id} story={story} />)}</div>
        ) : (
          <EmptyFavorites href="/stories" />
        )
      ) : data.characters.length ? (
        <div className="grid-chars">{data.characters.map((character) => <CharacterCard key={character.id} character={character} />)}</div>
      ) : (
        <EmptyFavorites href="/characters" />
      )}
    </div>
  );
}

function EmptyFavorites({ href }: { href: string }) {
  return (
    <Link href={href} className="empty-card">
      <Heart size={26} />
      아직 마음에 든 작품이 없어요.
    </Link>
  );
}
