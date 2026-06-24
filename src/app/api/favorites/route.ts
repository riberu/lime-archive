import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapCharacter, mapStory } from "@/lib/data";

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey");
  const supabase = getSupabaseServerClient();

  if (!supabase || !userKey) {
    return NextResponse.json({ stories: [], characters: [] });
  }

  const [{ data: storyLikes, error: storyError }, { data: characterLikes, error: characterError }] = await Promise.all([
    supabase
      .from("story_likes")
      .select("stories(*)")
      .eq("user_key", userKey),
    supabase
      .from("character_likes")
      .select("characters(*)")
      .eq("user_key", userKey)
  ]);

  if (storyError || characterError) {
    return NextResponse.json({ error: storyError?.message ?? characterError?.message }, { status: 500 });
  }

  const stories = (storyLikes ?? [])
    .map((row) => row.stories)
    .map(firstRecord)
    .filter(Boolean)
    .map((story) => mapStory(story as unknown as Parameters<typeof mapStory>[0]));

  const characters = (characterLikes ?? [])
    .map((row) => row.characters)
    .map(firstRecord)
    .filter(Boolean)
    .map((character) => mapCharacter(character as unknown as Parameters<typeof mapCharacter>[0]));

  return NextResponse.json({ stories, characters });
}

function firstRecord<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}
