import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const [storiesResult, charactersResult] = await Promise.all([
    supabase
      .from("stories")
      .select("id, title, description, visibility, created_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("characters")
      .select("id, name, description, visibility, created_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (storiesResult.error) return NextResponse.json({ error: storiesResult.error.message }, { status: 500 });
  if (charactersResult.error) return NextResponse.json({ error: charactersResult.error.message }, { status: 500 });

  const stories = (storiesResult.data ?? []).map((story) => ({
    id: story.id,
    type: "story" as const,
    title: story.title,
    description: story.description,
    visibility: story.visibility
  }));

  const characters = (charactersResult.data ?? []).map((character) => ({
    id: character.id,
    type: "character" as const,
    title: character.name,
    description: character.description,
    visibility: character.visibility
  }));

  return NextResponse.json({ items: [...stories, ...characters] });
}
