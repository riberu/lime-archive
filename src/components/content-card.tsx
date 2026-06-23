import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import type { Character, Story } from "@/lib/types";

export function StoryCard({ story }: { story: Story }) {
  return (
    <Link href={`/stories/${story.id}`} className="group overflow-hidden rounded-lg border border-[#e0ead4] bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-leaf-50">
        <Image src={story.thumbnailUrl} alt={story.title} fill className="object-cover transition-transform group-hover:scale-105" />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold">{story.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#66705f]">{story.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {story.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-leaf-50 px-2 py-1 text-xs text-leaf-900">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-[#7a866f]">
          <span className="flex items-center gap-1"><Heart size={14} />{story.likeCount}</span>
          <span className="flex items-center gap-1"><MessageCircle size={14} />{story.chatCount}</span>
        </div>
      </div>
    </Link>
  );
}

export function CharacterCard({ character }: { character: Character }) {
  return (
    <Link href={`/characters/${character.id}`} className="group rounded-lg border border-[#e0ead4] bg-white p-4">
      <div className="flex gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-leaf-50">
          <Image src={character.avatarUrl} alt={character.name} fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-1 font-semibold">{character.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#66705f]">{character.description}</p>
          <p className="mt-2 line-clamp-1 text-xs text-[#7a866f]">{character.personality}</p>
        </div>
      </div>
    </Link>
  );
}
