import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
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
  const story = await getStory(body.storyId);
  const title = body.title ?? story.title;
  const currentScene = body.scene || story.currentScene;
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const session: ChatSession = {
      id: slugId("session"),
      storyId: story.id,
      userId: body.userId ?? "demo-user",
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

    return NextResponse.json({ id: session.id });
  }

  const userId = body.userId ?? process.env.APP_DEMO_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "userId or APP_DEMO_USER_ID is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      story_id: story.id,
      user_id: userId,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (story.openingMessage) {
    await supabase.from("chat_messages").insert({
      session_id: data.id,
      role: "assistant",
      content: story.openingMessage
    });
  }

  return NextResponse.json(data);
}
