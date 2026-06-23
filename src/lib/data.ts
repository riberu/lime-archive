import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";
import type { Character, ChatMessage, ChatSession, Story } from "@/lib/types";

type StoryRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  system_prompt: string;
  opening_message: string | null;
  current_scene: string | null;
  status_text: string | null;
  tags: string[];
  visibility: "public" | "private";
  like_count: number;
  chat_count: number;
  created_at: string;
};

type CharacterRow = {
  id: string;
  creator_id: string;
  story_id: string | null;
  name: string;
  description: string;
  avatar_url: string | null;
  personality: string;
  speech_style: string;
  first_message: string | null;
  prompt: string;
  visibility: "public" | "private";
};

type SessionRow = {
  id: string;
  story_id: string;
  user_id: string;
  title: string;
  user_note: string;
  current_scene: string | null;
  memory_summary: string | null;
  episode_state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export async function getStories() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.stories;

  const { data } = await supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StoryRow[]>();

  return data?.map(mapStory) ?? localStore.stories;
}

export async function getCharacters(storyId?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return storyId ? localStore.characters.filter((character) => character.storyId === storyId) : localStore.characters;
  }

  let query = supabase.from("characters").select("*").order("created_at", { ascending: false });
  if (storyId) query = query.eq("story_id", storyId);
  const { data } = await query.returns<CharacterRow[]>();

  return data?.map(mapCharacter) ?? [];
}

export async function getCharacter(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.characters.find((character) => character.id === id) ?? localStore.characters[0];

  const { data } = await supabase.from("characters").select("*").eq("id", id).single<CharacterRow>();
  return data ? mapCharacter(data) : localStore.characters[0];
}

export async function getStory(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return localStore.stories.find((story) => story.id === id) ?? localStore.stories[0];
  }

  const { data } = await supabase.from("stories").select("*").eq("id", id).single<StoryRow>();
  return data ? mapStory(data) : localStore.stories[0];
}

export async function getSession(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.sessions.find((session) => session.id === id) ?? localStore.sessions[0];

  const { data } = await supabase.from("chat_sessions").select("*").eq("id", id).single<SessionRow>();
  return data ? mapSession(data) : localStore.sessions[0];
}

export async function getMessages(sessionId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.messages.filter((message) => message.sessionId === sessionId);

  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();
  return data?.map(mapMessage) ?? [];
}

export function mapStory(row: StoryRow): Story {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url ?? "",
    systemPrompt: row.system_prompt,
    openingMessage: row.opening_message ?? "",
    currentScene: row.current_scene ?? "",
    statusText: row.status_text ?? "",
    tags: row.tags,
    visibility: row.visibility,
    likeCount: row.like_count,
    chatCount: row.chat_count,
    createdAt: row.created_at
  };
}

export function mapCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    creatorId: row.creator_id,
    storyId: row.story_id ?? undefined,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatar_url ?? "",
    personality: row.personality,
    speechStyle: row.speech_style,
    firstMessage: row.first_message ?? "",
    prompt: row.prompt,
    visibility: row.visibility
  };
}

export function mapSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    storyId: row.story_id,
    userId: row.user_id,
    title: row.title,
    userNote: row.user_note,
    currentScene: row.current_scene ?? "",
    memorySummary: row.memory_summary ?? "",
    episodeState: row.episode_state ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
}
