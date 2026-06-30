import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";
import type { Character, ChatMessage, ChatSession, Story, World } from "@/lib/types";

type WorldRow = {
  id: string;
  creator_id: string | null;
  title: string;
  description: string;
  rules: string;
  image_url: string | null;
  visibility: "public" | "private";
  created_at: string;
  updated_at: string | null;
};

type StoryRow = {
  id: string;
  creator_id: string | null;
  world_id?: string | null;
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
  creator_id: string | null;
  story_id: string | null;
  world_id?: string | null;
  scope?: "independent" | "world";
  is_enabled?: boolean;
  name: string;
  description: string;
  gender?: string | null;
  age?: string | null;
  avatar_url: string | null;
  personality: string;
  speech_style: string;
  first_message: string | null;
  prompt: string;
  visibility: "public" | "private";
};

type StoryCharacterLinkRow = {
  character_id: string;
  role_note: string | null;
};

type SessionRow = {
  id: string;
  story_id: string;
  user_id: string | null;
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
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StoryRow[]>();

  if (error) {
    console.error("Failed to load stories from Supabase", error);
    return [];
  }

  return data?.map(mapStory) ?? [];
}

export async function getWorlds() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("worlds")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<WorldRow[]>();

  if (error) {
    console.error("Failed to load worlds from Supabase", error);
    return [];
  }

  return data?.map(mapWorld) ?? [];
}

export async function getWorld(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from("worlds").select("*").eq("id", id).single<WorldRow>();
  return data ? mapWorld(data) : null;
}

export async function getCharacters(storyId?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return storyId ? localStore.characters.filter((character) => character.storyId === storyId) : localStore.characters;
  }

  if (!storyId) {
    const { data } = await supabase
      .from("characters")
      .select("*")
      .or("scope.eq.independent,scope.is.null")
      .is("story_id", null)
      .order("created_at", { ascending: false })
      .returns<CharacterRow[]>();
    return data?.map((row) => mapCharacter(row)) ?? [];
  }

  const [directResult, linkResult] = await Promise.all([
    supabase.from("characters").select("*").eq("story_id", storyId).order("created_at", { ascending: false }).returns<CharacterRow[]>(),
    supabase.from("story_characters").select("character_id, role_note").eq("story_id", storyId).order("sort_order", { ascending: true }).returns<StoryCharacterLinkRow[]>()
  ]);

  const linkedIds = [...new Set((linkResult.data ?? []).map((link) => link.character_id))];
  const roleNoteById = new Map((linkResult.data ?? []).map((link) => [link.character_id, link.role_note ?? ""]));
  const linkedResult = linkedIds.length
    ? await supabase.from("characters").select("*").in("id", linkedIds).returns<CharacterRow[]>()
    : { data: [] as CharacterRow[] };

  return mergeCharacters([...(directResult.data ?? []), ...(linkedResult.data ?? [])]).map((row) => mapCharacter(row, roleNoteById.get(row.id)));
}

export async function getWorldCharacters(worldId: string, includeDisabled = true) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase.from("characters").select("*").eq("world_id", worldId).eq("scope", "world").order("created_at", { ascending: true });
  if (!includeDisabled) query = query.eq("is_enabled", true);
  const { data } = await query.returns<CharacterRow[]>();
  return data?.map((row) => mapCharacter(row)) ?? [];
}

export async function getCharacter(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.characters.find((character) => character.id === id) ?? null;

  const { data } = await supabase.from("characters").select("*").eq("id", id).single<CharacterRow>();
  return data ? mapCharacter(data) : null;
}

export async function getStory(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return localStore.stories.find((story) => story.id === id) ?? null;
  }

  const { data } = await supabase.from("stories").select("*").eq("id", id).single<StoryRow>();
  return data ? mapStory(data) : null;
}

export async function getSession(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return localStore.sessions.find((session) => session.id === id) ?? null;

  const { data } = await supabase.from("chat_sessions").select("*").eq("id", id).single<SessionRow>();
  return data ? mapSession(data) : null;
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

function mergeCharacters(rows: CharacterRow[]) {
  const byId = new Map<string, CharacterRow>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

export function mapStory(row: StoryRow): Story {
  return {
    id: row.id,
    creatorId: row.creator_id ?? "anonymous",
    worldId: row.world_id ?? undefined,
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

export function mapCharacter(row: CharacterRow, roleNote = ""): Character {
  return {
    id: row.id,
    creatorId: row.creator_id ?? "anonymous",
    storyId: row.story_id ?? undefined,
    worldId: row.world_id ?? undefined,
    roleNote,
    scope: row.scope ?? (row.story_id || row.world_id ? "world" : "independent"),
    isEnabled: row.is_enabled ?? true,
    name: row.name,
    description: row.description,
    gender: row.gender ?? "",
    age: row.age ?? "",
    avatarUrl: row.avatar_url ?? "",
    personality: row.personality,
    speechStyle: row.speech_style,
    firstMessage: row.first_message ?? "",
    prompt: row.prompt,
    visibility: row.visibility
  };
}

export function mapWorld(row: WorldRow): World {
  return {
    id: row.id,
    creatorId: row.creator_id ?? "anonymous",
    title: row.title,
    description: row.description,
    rules: row.rules,
    imageUrl: row.image_url ?? "",
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

export function mapSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    storyId: row.story_id,
    userId: row.user_id ?? "anonymous",
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
