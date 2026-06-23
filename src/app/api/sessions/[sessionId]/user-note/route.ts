import { NextResponse } from "next/server";
import { localStore, nowIso } from "@/lib/local-store";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userNote } = (await request.json()) as { userNote?: string };
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const session = localStore.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.userNote = userNote ?? "";
      session.updatedAt = nowIso();
    }
  } else {
    const { error } = await supabase
      .from("chat_sessions")
      .update({ user_note: userNote ?? "", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
