import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle, Star } from "lucide-react";
import type { Character, Story } from "@/lib/types";

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80";
const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export function StoryCard({ story }: { story: Story }) {
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <Link href={`/stories/${story.id}`} className="bookcard">
      <div className="cover">
        <Image src={imageSrc} alt={story.title} fill suppressHydrationWarning className="object-cover transition-transform duration-300 hover:scale-105" />
        <span className="tag orig">ORIGINAL</span>
      </div>
      <h3 className="bt">{story.title}</h3>
      <p className="bs">
        <span className="v">{story.chatCount.toLocaleString("ko-KR")}</span> 대화 · <span className="v">{story.likeCount.toLocaleString("ko-KR")}</span> 좋아요
      </p>
    </Link>
  );
}

export function WideStoryCard({ story, rank }: { story: Story; rank: number }) {
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <Link href={`/stories/${story.id}`} className="best">
      <span className={`rk ${rank <= 3 ? "top" : ""}`}>{rank}</span>
      <span className="bav relative overflow-hidden">
        <Image src={imageSrc} alt={story.title} fill suppressHydrationWarning className="object-cover" />
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
  const imageSrc = character.avatarUrl || fallbackCharacterImage;

  return (
    <Link href={`/characters/${character.id}`} className="clcard">
      <span className="av relative block overflow-hidden">
        <Image src={imageSrc} alt={character.name} fill suppressHydrationWarning className="object-cover" />
      </span>
      <h3 className="cn">{character.name}</h3>
      <p className="cd">{character.description}</p>
      <span className="ct">{character.personality || "캐릭터"}</span>
      <p className="talks">
        <MessageCircle size={12} className="inline" /> 바로 대화하기
      </p>
    </Link>
  );
}

export function DarkCharacterCard({ character }: { character: Character }) {
  const imageSrc = character.avatarUrl || fallbackCharacterImage;

  return (
    <Link href={`/characters/${character.id}`} className="ui-character-card block p-4">
      <div className="relative mb-3 size-[52px] overflow-hidden rounded-full border-2 border-[#a3e635] bg-[#e7e8ea]">
        <Image src={imageSrc} alt={character.name} fill suppressHydrationWarning className="object-cover" />
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
