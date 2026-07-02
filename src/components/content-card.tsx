import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle, Sparkles, Star } from "lucide-react";
import type { Character, Story } from "@/lib/types";

export function StoryCard({ story }: { story: Story }) {
  const tag = story.tags[0] || "Original";

  return (
    <Link href={`/stories/${story.id}`} className="bookcard">
      <div className="cover">
        {story.thumbnailUrl ? (
          <Image src={story.thumbnailUrl} alt={story.title} fill suppressHydrationWarning className="object-cover transition-transform duration-300 hover:scale-105" />
        ) : (
          <span className="cover-placeholder">
            <Sparkles size={24} />
            <b>{story.title.slice(0, 2)}</b>
          </span>
        )}
        <span className="cover-grad" />
        <span className="tag orig">{tag}</span>
        <span className="cover-stat">
          <MessageCircle size={12} /> {compactNumber(story.chatCount)}
        </span>
      </div>
      <h3 className="bt">{story.title}</h3>
      <p className="bd">{story.description}</p>
      <p className="bs">
        <span className="v">{story.chatCount.toLocaleString("ko-KR")}</span> 대화 · <span className="v">{story.likeCount.toLocaleString("ko-KR")}</span> 좋아요
      </p>
    </Link>
  );
}

export function WideStoryCard({ story, rank }: { story: Story; rank: number }) {
  return (
    <Link href={`/stories/${story.id}`} className="best">
      <span className={`rk ${rank <= 3 ? "top" : ""}`}>{rank}</span>
      <span className="bav relative overflow-hidden">
        {story.thumbnailUrl ? <Image src={story.thumbnailUrl} alt={story.title} fill suppressHydrationWarning className="object-cover" /> : <span className="mini-placeholder">{story.title.slice(0, 1)}</span>}
      </span>
      <span className="bi">
        <b className="bn">{story.title}</b>
        <small className="bm">
          {story.tags.slice(0, 2).map((tag) => `#${tag}`).join(" ")} · {story.chatCount.toLocaleString("ko-KR")} 대화
        </small>
      </span>
      <Star className="star" size={17} />
    </Link>
  );
}

export function CharacterCard({ character }: { character: Character }) {
  const avatarUrl = getUsableCharacterAvatar(character.avatarUrl);
  const label = character.personality || character.gender || "캐릭터";

  return (
    <Link href={`/characters/${character.id}`} className="clcard">
      <span className="av relative block overflow-hidden">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={character.name} fill suppressHydrationWarning className="object-cover" />
        ) : (
          <span className="character-placeholder">
            <b>{character.name.slice(0, 1)}</b>
            <small>{character.gender || "Lime Character"}</small>
          </span>
        )}
        <span className="avatar-grad" />
        <span className="ct">{label}</span>
      </span>
      <h3 className="cn">{character.name}</h3>
      <p className="cd">{character.description}</p>
      <p className="talks">
        <MessageCircle size={12} className="inline" /> 바로 대화하기
      </p>
    </Link>
  );
}

export function WideCharacterCard({ character, rank }: { character: Character; rank: number }) {
  const avatarUrl = getUsableCharacterAvatar(character.avatarUrl);

  return (
    <Link href={`/characters/${character.id}`} className="best">
      <span className={`rk ${rank <= 3 ? "top" : ""}`}>{rank}</span>
      <span className="bav relative overflow-hidden">
        {avatarUrl ? <Image src={avatarUrl} alt={character.name} fill suppressHydrationWarning className="object-cover" /> : <span className="mini-placeholder">{character.name.slice(0, 1)}</span>}
      </span>
      <span className="bi">
        <b className="bn">{character.name}</b>
        <small className="bm">{character.personality || character.description}</small>
      </span>
      <Sparkles className="star" size={16} />
    </Link>
  );
}

export function DarkCharacterCard({ character }: { character: Character }) {
  const avatarUrl = getUsableCharacterAvatar(character.avatarUrl);

  return (
    <Link href={`/characters/${character.id}`} className="ui-character-card block p-4">
      <div className="relative mb-3 size-[52px] overflow-hidden rounded-full border-2 border-[#a3e635] bg-[#e7e8ea]">
        {avatarUrl ? <Image src={avatarUrl} alt={character.name} fill suppressHydrationWarning className="object-cover" /> : <span className="mini-placeholder">{character.name.slice(0, 1)}</span>}
      </div>
      <h3 className="mb-1 text-[15px] font-bold text-white">{character.name}</h3>
      <p className="mb-3 line-clamp-2 min-h-[2.7em] text-[12.5px] leading-5 text-[#aab0b9]">{character.description}</p>
      <p className="rounded-[11px] rounded-bl-[3px] bg-[#22262d] px-3 py-2 text-xs leading-5 text-[#c9ced6]">
        {character.firstMessage || "대화를 시작할 준비가 되어 있어요."}
      </p>
      <p className="mt-3 text-[11.5px] font-bold text-[#a3e635]">
        <Heart size={12} className="inline" /> 바로 대화하기
      </p>
    </Link>
  );
}

function compactNumber(value: number) {
  if (value >= 10000) return `${Math.floor(value / 1000) / 10}만`;
  if (value >= 1000) return `${Math.floor(value / 100) / 10}천`;
  return value.toLocaleString("ko-KR");
}

function getUsableCharacterAvatar(value: string) {
  if (!value) return "";
  if (value.includes("photo-1494790108377-be9c29b29330")) return "";
  return value;
}
