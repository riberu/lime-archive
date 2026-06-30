import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { deleteMemory, isMemoryType, updateMemory } from "@/lib/memories";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";
import type { MemoryEntryType } from "@/lib/types";

type MemoryRouteParams = {
  params: Promise<{ memoryId: string }>;
};

type PatchPayload = {
  type?: MemoryEntryType;
  episodeNo?: number;
  subjectKey?: string;
  title?: string;
  content?: string;
  tags?: string[];
  importance?: number;
};

export async function PATCH(request: Request, { params }: MemoryRouteParams) {
  const { memoryId } = await params;
  const body = (await request.json()) as PatchPayload;
  const access = await canAccessMemory(request, memoryId);
  if ("response" in access) return access.response;

  if (body.type && !isMemoryType(body.type)) {
    return NextResponse.json({ error: "Invalid memory type" }, { status: 400 });
  }

  try {
    const memory = await updateMemory(memoryId, body);
    if (!memory) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: MemoryRouteParams) {
  const { memoryId } = await params;
  const access = await canAccessMemory(request, memoryId);
  if ("response" in access) return access.response;

  try {
    await deleteMemory(memoryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete memory" }, { status: 500 });
  }
}

async function canAccessMemory(request: Request, memoryId: string): Promise<{ ok: true } | { response: NextResponse }> {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const memory = localStore.memories.find((item) => item.id === memoryId);
    if (!memory) return { response: NextResponse.json({ error: "Memory not found" }, { status: 404 }) };
    return { ok: true };
  }

  if (!user) return { response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const { data: memory, error: memoryError } = await supabase
    .from("memory_entries")
    .select("session_id")
    .eq("id", memoryId)
    .maybeSingle<{ session_id: string }>();

  if (memoryError) return { response: NextResponse.json({ error: memoryError.message }, { status: 500 }) };
  if (!memory) return { response: NextResponse.json({ error: "Memory not found" }, { status: 404 }) };

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", memory.session_id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (sessionError) return { response: NextResponse.json({ error: sessionError.message }, { status: 500 }) };
  if (!session) return { response: NextResponse.json({ error: "Memory not found" }, { status: 404 }) };

  return { ok: true };
}
