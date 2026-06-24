import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import type { Character, Story } from "@/lib/types";

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80";
const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export function StoryCard({ story }: { story: Story }) {
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <Link href={`/stories/${story.id}`} className="ui-story-card group block">
      <div className="ui-story-cover mb-3">
        <Image src={imageSrc} alt={story.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
        <span className="absolute left-2 top-2 rounded-[5px] bg-[#a3e635] px-2 py-1 text-[10px] font-extrabold text-[#1a2e05]">ORIGINAL</span>
      </div>
      <h3 className="ui-story-title mb-2">{story.title}</h3>
      <div className="flex items-center gap-3 text-xs text-[#6b7280]">
        <span className="inline-flex items-center gap-1">
          <Heart size={13} /> <b className="font-semibold text-[#1f2328]">{story.likeCount}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={13} /> <b className="font-semibold text-[#1f2328]">{story.chatCount}</b>
        </span>
      </div>
    </Link>
  );
}

export function WideStoryCard({ story, rank }: { story: Story; rank: number }) {
  const imageSrc = story.thumbnailUrl || fallbackStoryImage;

  return (
    <Link href={`/stories/${story.id}`} className="ui-rank-card">
      <div className="ui-rank-number">{rank}</div>
      <div className="relative h-[78px] w-[58px] shrink-0 overflow-hidden rounded-lg bg-[#e7e8ea]">
        <Image src={imageSrc} alt={story.title} fill className="object-cover" />
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 font-story text-sm font-bold leading-snug">{story.title}</h3>
        <p className="mt-1 text-xs text-[#6b7280]">{story.chatCount} chats · {story.likeCount} likes</p>
      </div>
    </Link>
  );
}

export function CharacterCard({ character }: { character: Character }) {
  const imageSrc = character.avatarUrl || fallbackCharacterImage;

  return (
    <Link href={`/characters/${character.id}`} className="group rounded-[15px] border border-[#ececef] bg-white p-4">
      <div className="flex gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#e7e8ea]">
          <Image src={imageSrc} alt={character.name} fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-1 font-semibold">{character.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#6b7280]">{character.description}</p>
          <p className="mt-2 line-clamp-1 text-xs text-[#9ca3af]">{character.personality}</p>
        </div>
      </div>
    </Link>
  );
}

export function DarkCharacterCard({ character }: { character: Character }) {
  const imageSrc = character.avatarUrl || fallbackCharacterImage;

  return (
    <Link href={`/characters/${character.id}`} className="ui-character-card block p-4">
      <div className="relative mb-3 size-[52px] overflow-hidden rounded-full border-2 border-[#a3e635] bg-[#e7e8ea]">
        <Image src={imageSrc} alt={character.name} fill className="object-cover" />
      </div>
      <h3 className="mb-1 text-[15px] font-bold text-white">{character.name}</h3>
      <p className="mb-3 line-clamp-2 min-h-[2.7em] text-[12.5px] leading-5 text-[#aab0b9]">{character.description}</p>
      <p className="rounded-[11px] rounded-bl-[3px] bg-[#22262d] px-3 py-2 text-xs leading-5 text-[#c9ced6]">
        {character.firstMessage || "대화를 시작할 준비가 되어 있어요."}
      </p>
      <p className="mt-3 text-[11.5px] font-bold text-[#a3e635]">바로 대화하기</p>
    </Link>
  );
}
