import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { createMemory, ensureBaseCharacterMemories, hasOutdatedGeneratedMemories, isMemoryType, listMemories, purgeOutdatedGeneratedMemories, recordMemoriesFromTurn } from "@/lib/memories";
import { extractProtagonistName } from "@/lib/prompt";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";
import type { ChatMessage } from "@/lib/types";
import type { MemoryEntryType } from "@/lib/types";

type MemoryPayload = {
  sessionId?: string;
  type?: MemoryEntryType;
  episodeNo?: number;
  subjectKey?: string;
  title?: string;
  content?: string;
  tags?: string[];
  importance?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const access = await canAccessSession(request, sessionId);
  if ("response" in access) return access.response;

  await ensureBaseCharacters(sessionId);
  let memories = await listMemories(sessionId);
  if (hasOutdatedGeneratedMemories(memories)) {
    await purgeOutdatedGeneratedMemories(sessionId).catch((error) => console.error("Failed to purge outdated memories", error));
    memories = await listMemories(sessionId);
  }
  if (!hasConversationMemories(memories)) {
    await backfillMemoriesFromMessages(sessionId).catch((error) => console.error("Failed to backfill memories", error));
    memories = await listMemories(sessionId);
  }
  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const body = (await request.json()) as MemoryPayload;
  const sessionId = body.sessionId ?? "";
  const type = body.type ?? "";
  const content = body.content?.trim() ?? "";

  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  if (!isMemoryType(type)) return NextResponse.json({ error: "Invalid memory type" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const access = await canAccessSession(request, sessionId);
  if ("response" in access) return access.response;

  try {
    const memory = await createMemory({
      sessionId,
      type,
      episodeNo: body.episodeNo,
      subjectKey: body.subjectKey,
      title: body.title,
      content,
      tags: body.tags,
      importance: body.importance
    });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create memory" }, { status: 500 });
  }
}

async function canAccessSession(request: Request, sessionId: string): Promise<{ ok: true } | { response: NextResponse }> {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const session = localStore.sessions.find((item) => item.id === sessionId);
    if (!session) return { response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
    return { ok: true };
  }

  if (!user) return { response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (error) return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data) return { response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  return { ok: true };
}

async function ensureBaseCharacters(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return;
  const characters = await getCharacters(session.storyId);
  await ensureBaseCharacterMemories(sessionId, characters);
}

async function backfillMemoriesFromMessages(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return;

  const [story, messages] = await Promise.all([getStory(session.storyId), getMessages(session.id)]);
  if (!story || messages.length < 2) return;

  const characters = await getCharacters(story.id);
  const pairs = pairConversationTurns(messages).slice(-12);
  for (const pair of pairs) {
    await recordMemoriesFromTurn({
      sessionId,
      userText: pair.user,
      assistantText: pair.assistant,
      characters,
      currentScene: session.currentScene || story.currentScene,
      protagonistName: extractProtagonistName(session.userNote),
      messageCount: pair.index
    });
  }
}

function hasConversationMemories(memories: Awaited<ReturnType<typeof listMemories>>) {
  return memories.some((memory) => memory.type !== "character" || !memory.tags.includes("base-character"));
}

function pairConversationTurns(messages: ChatMessage[]) {
  const pairs: Array<{ user: string; assistant: string; index: number }> = [];
  let pendingUser = "";

  messages.forEach((message, index) => {
    if (message.role === "user") {
      pendingUser = message.content;
      return;
    }

    if (message.role === "assistant" && message.content.trim()) {
      pairs.push({
        user: pendingUser,
        assistant: message.content,
        index
      });
      pendingUser = "";
    }
  });

  return pairs;
}
