import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ worldId: string }>;
};

type WorldUpdatePayload = {
  title?: string;
  description?: string;
  rules?: string;
  image_url?: string;
  visibility?: "public" | "private";
};

export async function PATCH(request: Request, context: RouteContext) {
  const { worldId } = await context.params;
  const body = (await request.json()) as WorldUpdatePayload;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  if (body.visibility === "public") {
    const { count, error: countError } = await supabase
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("world_id", worldId)
      .eq("scope", "world")
      .eq("is_enabled", true);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if (!count) return NextResponse.json({ error: "캐릭터를 1명 이상 등록해야 세계관을 공개할 수 있습니다." }, { status: 400 });
  }

  const payload = normalizePayload(body);
  const { data, error } = await supabase
    .from("worlds")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", worldId)
    .eq("creator_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { worldId } = await context.params;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase.from("worlds").delete().eq("id", worldId).eq("creator_id", user.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "삭제할 세계관을 찾지 못했습니다." }, { status: 404 });
  return NextResponse.json({ id: worldId });
}

function normalizePayload(body: WorldUpdatePayload) {
  const payload: Record<string, string> = {};
  if (typeof body.title === "string") payload.title = body.title.trim();
  if (typeof body.description === "string") payload.description = body.description.trim();
  if (typeof body.rules === "string") payload.rules = body.rules.trim();
  if (typeof body.image_url === "string") payload.image_url = body.image_url.trim();
  if (body.visibility) payload.visibility = body.visibility;
  return payload;
}
