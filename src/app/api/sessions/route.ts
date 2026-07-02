import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCharacter, getCharacters, getStory } from "@/lib/data";
import { ensureBaseCharacterMemories } from "@/lib/memories";
import { ensurePublicProfile } from "@/lib/profile-sync";
import { getStoryStartSetting } from "@/lib/start-settings";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import type { ChatSession } from "@/lib/types";

type SessionPayload = {
  storyId: string;
  characterId?: string;
  title?: string;
  userNote?: string;
  scene?: string;
  startSettingId?: string;
};

type SessionListItem = {
  id: string;
  title: string;
  storyTitle: string;
  imageUrl: string;
  imageKind: "story" | "character";
  updatedAt: string;
  pinned: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SessionPayload;
  const result = await createSession(body, request);
  if ("response" in result) return result.response;
  return NextResponse.json({ id: result.id });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storyId = url.searchParams.get("storyId");
  if (!storyId) {
    const result = await listSessions(request);
    if ("response" in result) return result.response;
    return NextResponse.json({ sessions: result.sessions });
  }

  const result = await createSession(
    {
      storyId,
      scene: url.searchParams.get("scene") ?? undefined,
      title: url.searchParams.get("title") ?? undefined,
      startSettingId: url.searchParams.get("startSettingId") ?? undefined
    },
    request
  );

  if ("response" in result) return result.response;
  return NextResponse.redirect(new URL(`/chat/${result.id}`, request.url));
}

async function listSessions(request: Request): Promise<{ sessions: SessionListItem[] } | { response: NextResponse }> {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    return {
      sessions: [...localStore.sessions]
        .sort((a, b) => Number(Boolean(b.episodeState?.pinned)) - Number(Boolean(a.episodeState?.pinned)) || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20)
        .map((session) => {
          const story = localStore.stories.find((item) => item.id === session.storyId);
          const characterId = getSessionCharacterId(session.episodeState);
          const character = characterId ? localStore.characters.find((item) => item.id === characterId && !item.storyId && (!item.scope || item.scope === "independent")) : null;
          return {
            id: session.id,
            title: session.title,
            storyTitle: story?.title ?? "",
            imageUrl: character?.avatarUrl || story?.thumbnailUrl || "",
            imageKind: character ? "character" as const : "story" as const,
            updatedAt: session.updatedAt,
            pinned: Boolean(session.episodeState?.pinned)
          };
        })
    };
  }

  if (!user) return { sessions: [] };

  const profileError = await ensurePublicProfile(supabase, user);
  if (profileError) {
    return { response: NextResponse.json({ error: profileError }, { status: 500 }) };
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, story_id, title, updated_at, created_at, episode_state")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
    .returns<Array<{ id: string; story_id: string; title: string; updated_at: string | null; created_at: string; episode_state: Record<string, unknown> | null }>>();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  const storyIds = [...new Set((data ?? []).map((session) => session.story_id))];
  const characterIds = [
    ...new Set(
      (data ?? [])
        .map((session) => getSessionCharacterId(session.episode_state))
        .filter(Boolean)
    )
  ];

  const { data: storyRows } = storyIds.length
    ? await supabase
        .from("stories")
        .select("id, title, thumbnail_url")
        .in("id", storyIds)
        .returns<Array<{ id: string; title: string; thumbnail_url: string | null }>>()
    : { data: [] as Array<{ id: string; title: string; thumbnail_url: string | null }> };

  const { data: characterRows } = characterIds.length
    ? await supabase
        .from("characters")
        .select("id, story_id, scope, avatar_url")
        .in("id", characterIds)
        .returns<Array<{ id: string; story_id: string | null; scope: string | null; avatar_url: string | null }>>()
    : { data: [] as Array<{ id: string; story_id: string | null; scope: string | null; avatar_url: string | null }> };

  const storyById = new Map((storyRows ?? []).map((story) => [story.id, story]));
  const independentCharacterById = new Map(
    (characterRows ?? [])
      .filter((character) => !character.story_id && (character.scope === "independent" || !character.scope))
      .map((character) => [character.id, character])
  );

  return {
    sessions: (data ?? [])
      .map((session) => {
        const story = storyById.get(session.story_id);
        const characterId = getSessionCharacterId(session.episode_state);
        const character = characterId ? independentCharacterById.get(characterId) : null;

        return {
          id: session.id,
          title: session.title,
          storyTitle: story?.title ?? "",
          imageUrl: character?.avatar_url || story?.thumbnail_url || "",
          imageKind: character ? "character" as const : "story" as const,
          updatedAt: session.updated_at ?? session.created_at,
          pinned: Boolean(session.episode_state?.pinned)
        };
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)
  };
}

async function createSession(body: SessionPayload, request: Request): Promise<{ id: string } | { response: NextResponse }> {
  const story = await getStory(body.storyId);
  if (!story) {
    return { response: NextResponse.json({ error: "스토리를 찾지 못했어요." }, { status: 404 }) };
  }

  const character = body.characterId ? await getCharacter(body.characterId) : null;
  if (character && (character.storyId || (character.scope && character.scope !== "independent"))) {
    return { response: NextResponse.json({ error: "스토리 소속 캐릭터는 개별 캐릭터 채팅으로 시작할 수 없습니다." }, { status: 403 }) };
  }

  const startSetting = getStoryStartSetting(story, body.startSettingId);
  const isFreeStart = startSetting.mode === "free";
  const title = body.title ?? character?.name ?? story.title;
  const currentScene = body.scene || startSetting.currentScene || story.currentScene;
  const statusText = startSetting.statusText || story.statusText;
  const openingMessage = character?.firstMessage || (isFreeStart ? "" : startSetting.openingMessage || story.openingMessage);
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!user) {
    return { response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const episodeState = {
    characterId: character?.id,
    characterName: character?.name,
    statusText,
    startSettingId: startSetting.id,
    startSettingTitle: startSetting.title,
    startMode: startSetting.mode,
    startGuide: startSetting.guide,
    suggestedReplies: startSetting.suggestedReplies,
    startedAt: nowIso()
  };

  if (!supabase) {
    const session: ChatSession = {
      id: slugId("session"),
      storyId: story.id,
      userId: user.id,
      title,
      userNote: body.userNote ?? "",
      currentScene,
      memorySummary: "",
      episodeState,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    localStore.sessions.unshift(session);
    if (openingMessage.trim()) {
      localStore.messages.push({
        id: slugId("message"),
        sessionId: session.id,
        role: "assistant",
        content: openingMessage,
        createdAt: nowIso()
      });
    }

    const characters = await getCharacters(story.id);
    await ensureBaseCharacterMemories(session.id, characters).catch((error) => console.error("Failed to prepare base character memories", error));

    return { id: session.id };
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      story_id: story.id,
      user_id: user.id,
      title,
      user_note: body.userNote ?? "",
      current_scene: currentScene,
      memory_summary: "",
      episode_state: episodeState
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  if (openingMessage.trim()) {
    await supabase.from("chat_messages").insert({
      session_id: data.id,
      role: "assistant",
      content: openingMessage
    });
  }

  const characters = await getCharacters(story.id);
  await ensureBaseCharacterMemories(data.id, characters).catch((error) => console.error("Failed to prepare base character memories", error));

  await supabase
    .from("stories")
    .update({ chat_count: story.chatCount + 1, updated_at: new Date().toISOString() })
    .eq("id", story.id);

  return { id: data.id };
}

function getSessionCharacterId(value: Record<string, unknown> | null | undefined) {
  const characterId = value?.characterId;
  return typeof characterId === "string" && characterId ? characterId : "";
}
