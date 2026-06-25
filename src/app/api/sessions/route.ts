import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { ensurePublicProfile } from "@/lib/profile-sync";
import type { ChatMessage, ChatSession } from "@/lib/types";

type SessionPayload = {
  storyId: string;
  userId?: string;
  title?: string;
  userNote?: string;
  scene?: string;
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

  const result = await createSession({
    storyId,
    scene: url.searchParams.get("scene") ?? undefined,
    title: url.searchParams.get("title") ?? undefined
  }, request);

  if ("response" in result) return result.response;
  return NextResponse.redirect(new URL(`/chat/${result.id}`, request.url));
}

async function listSessions(request: Request): Promise<
  | { sessions: Array<{ id: string; title: string; storyTitle: string; updatedAt: string; pinned: boolean }> }
  | { response: NextResponse }
> {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    return {
      sessions: [...localStore.sessions]
        .sort((a, b) => Number(Boolean(b.episodeState?.pinned)) - Number(Boolean(a.episodeState?.pinned)) || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20)
        .map((session) => {
          const story = localStore.stories.find((item) => item.id === session.storyId);
          return {
            id: session.id,
            title: session.title,
            storyTitle: story?.title ?? "",
            updatedAt: session.updatedAt,
            pinned: Boolean(session.episodeState?.pinned)
          };
        })
    };
  }

  if (!user) {
    return { sessions: [] };
  }

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
  const { data: storyRows } = storyIds.length
    ? await supabase
        .from("stories")
        .select("id, title")
        .in("id", storyIds)
        .returns<Array<{ id: string; title: string }>>()
    : { data: [] as Array<{ id: string; title: string }> };
  const storyTitleById = new Map((storyRows ?? []).map((story) => [story.id, story.title]));

  return {
    sessions: (data ?? [])
      .map((session) => ({
        id: session.id,
        title: session.title,
        storyTitle: storyTitleById.get(session.story_id) ?? "",
        updatedAt: session.updated_at ?? session.created_at,
        pinned: Boolean(session.episode_state?.pinned)
      }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)
  };
}

async function createSession(body: SessionPayload, request: Request): Promise<{ id: string } | { response: NextResponse }> {
  const story = await getStory(body.storyId);
  if (!story) {
    return { response: NextResponse.json({ error: "Story not found" }, { status: 404 }) };
  }

  const title = body.title ?? story.title;
  const currentScene = body.scene || story.currentScene;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!user) {
    return { response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  if (!supabase) {
    const session: ChatSession = {
      id: slugId("session"),
      storyId: story.id,
      userId: user.id,
      title,
      userNote: body.userNote ?? "",
      currentScene,
      memorySummary: "",
      episodeState: {
        statusText: story.statusText,
        startedAt: nowIso()
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const opening: ChatMessage = {
      id: slugId("message"),
      sessionId: session.id,
      role: "assistant",
      content: story.openingMessage,
      createdAt: nowIso()
    };

    localStore.sessions.unshift(session);
    localStore.messages.push(opening);

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
      episode_state: {
        statusText: story.statusText,
        startedAt: nowIso()
      }
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  if (story.openingMessage) {
    await supabase.from("chat_messages").insert({
      session_id: data.id,
      role: "assistant",
      content: story.openingMessage
    });
  }

  await supabase
    .from("stories")
    .update({ chat_count: story.chatCount + 1, updated_at: new Date().toISOString() })
    .eq("id", story.id);

  return { id: data.id };
}
