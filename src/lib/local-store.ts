import type { Character, ChatMessage, ChatSession, MemoryEntry, Story, World } from "@/lib/types";

const globalStore = globalThis as typeof globalThis & {
  __limeArchiveStore?: {
    stories: Story[];
    worlds: World[];
    characters: Character[];
    sessions: ChatSession[];
    messages: ChatMessage[];
    memories: MemoryEntry[];
  };
};

export const localStore =
  globalStore.__limeArchiveStore ??
  (globalStore.__limeArchiveStore = {
    stories: [],
    worlds: [],
    characters: [],
    sessions: [],
    messages: [],
    memories: []
  });

export function nowIso() {
  return new Date().toISOString();
}

export function slugId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function clearLocalStore() {
  localStore.sessions = [];
  localStore.messages = [];
  localStore.memories = [];
}
