import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore, nowIso } from "@/lib/local-store";

type PatchPayload = {
  title?: string;
  pinned?: boolean;
  memorySummary?: string;
};

type SessionRouteParams = {
  params: Promise<{ sessionId: string }>;
};

export async function PATCH(request: Request, { params }: SessionRouteParams) {
  const { sessionId } = await params;
  const body = (await request.json()) as PatchPayload;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const hasPinned = typeof body.pinned === "boolean";
  const hasMemorySummary = typeof body.memorySummary === "string";

  if (!title && !hasPinned && !hasMemorySummary) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (!supabase) {
    const session = localStore.sessions.find((item) => item.id === sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (title) session.title = title;
    if (hasPinned) session.episodeState = { ...session.episodeState, pinned: body.pinned };
    if (hasMemorySummary) session.memorySummary = body.memorySummary ?? "";
    session.updatedAt = nowIso();
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        pinned: Boolean(session.episodeState?.pinned),
        updatedAt: session.updatedAt
      }
    });
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: current, error: readError } = await supabase
    .from("chat_sessions")
    .select("episode_state")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single<{ episode_state: Record<string, unknown> | null }>();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (title) update.title = title;
  if (hasPinned) update.episode_state = { ...(current?.episode_state ?? {}), pinned: body.pinned };
  if (hasMemorySummary) update.memory_summary = body.memorySummary ?? "";

  const { data, error } = await supabase
    .from("chat_sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id, title, updated_at, episode_state")
    .single<{ id: string; title: string; updated_at: string; episode_state: Record<string, unknown> | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: {
      id: data.id,
      title: data.title,
      pinned: Boolean(data.episode_state?.pinned),
      updatedAt: data.updated_at
    }
  });
}

export async function DELETE(request: Request, { params }: SessionRouteParams) {
  const { sessionId } = await params;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const before = localStore.sessions.length;
    localStore.sessions = localStore.sessions.filter((item) => item.id !== sessionId);
    localStore.messages = localStore.messages.filter((item) => item.sessionId !== sessionId);
    if (localStore.sessions.length === before) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
