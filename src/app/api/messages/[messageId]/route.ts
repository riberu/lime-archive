import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";

type MessageRouteParams = {
  params: Promise<{ messageId: string }>;
};

type PatchPayload = {
  content?: string;
  truncateAfter?: boolean;
};

export async function PATCH(request: Request, { params }: MessageRouteParams) {
  const { messageId } = await params;
  const body = (await request.json()) as PatchPayload;
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const message = localStore.messages.find((item) => item.id === messageId);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    message.content = content;
    if (body.truncateAfter) {
      localStore.messages = localStore.messages.filter(
        (item) => item.sessionId !== message.sessionId || item.createdAt <= message.createdAt
      );
    }
    return NextResponse.json({ message });
  }

  const { data: current, error: readError } = await supabase
    .from("chat_messages")
    .select("id, session_id, created_at")
    .eq("id", messageId)
    .single<{ id: string; session_id: string; created_at: string }>();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 404 });
  }

  if (body.truncateAfter) {
    const { error: deleteError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", current.session_id)
      .gt("created_at", current.created_at);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .update({ content })
    .eq("id", messageId)
    .select("id, session_id, role, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
