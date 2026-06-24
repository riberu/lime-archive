import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

type LikePayload = {
  userKey?: string;
};

export async function GET(request: Request, context: RouteContext) {
  const { storyId } = await context.params;
  const userKey = new URL(request.url).searchParams.get("userKey");
  const supabase = getSupabaseServerClient();

  if (!supabase || !userKey) return NextResponse.json({ liked: false });

  const { data } = await supabase
    .from("story_likes")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_key", userKey)
    .maybeSingle();

  return NextResponse.json({ liked: Boolean(data) });
}

export async function POST(request: Request, context: RouteContext) {
  const { storyId } = await context.params;
  const body = (await request.json()) as LikePayload;
  const userKey = body.userKey?.trim();
  const supabase = getSupabaseServerClient();

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!userKey) return NextResponse.json({ error: "userKey is required" }, { status: 400 });

  const existing = await supabase
    .from("story_likes")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_key", userKey)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });

  if (existing.data) {
    const removed = await supabase.from("story_likes").delete().eq("story_id", storyId).eq("user_key", userKey);
    if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });

    const story = await adjustLikeCount(storyId, -1);
    return NextResponse.json({ liked: false, likeCount: story.like_count });
  }

  const inserted = await supabase.from("story_likes").insert({ story_id: storyId, user_key: userKey });
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 });

  const story = await adjustLikeCount(storyId, 1);
  return NextResponse.json({ liked: true, likeCount: story.like_count });
}

async function adjustLikeCount(storyId: string, delta: 1 | -1) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: current, error: readError } = await supabase
    .from("stories")
    .select("like_count")
    .eq("id", storyId)
    .single<{ like_count: number }>();

  if (readError) throw readError;

  const likeCount = Math.max(0, (current.like_count ?? 0) + delta);
  const { data, error } = await supabase
    .from("stories")
    .update({ like_count: likeCount, updated_at: new Date().toISOString() })
    .eq("id", storyId)
    .select("like_count")
    .single<{ like_count: number }>();

  if (error) throw error;
  return data;
}
