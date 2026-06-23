import { demoCharacters, demoMessages, demoSession, demoStories } from "@/lib/mock-data";
import type { Character, ChatMessage, ChatSession, Story } from "@/lib/types";

const globalStore = globalThis as typeof globalThis & {
  __limeArchiveStore?: {
    stories: Story[];
    characters: Character[];
    sessions: ChatSession[];
    messages: ChatMessage[];
  };
};

export const localStore =
  globalStore.__limeArchiveStore ??
  (globalStore.__limeArchiveStore = {
    stories: [...demoStories],
    characters: [...demoCharacters],
    sessions: [demoSession],
    messages: [...demoMessages]
  });

export function nowIso() {
  return new Date().toISOString();
}

export function slugId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
