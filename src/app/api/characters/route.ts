import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore, slugId } from "@/lib/local-store";
import type { Character } from "@/lib/types";

type CharacterPayload = {
  name?: string;
  description?: string;
  avatar_url?: string;
  personality?: string;
  speech_style?: string;
  relationship?: string;
  first_message?: string;
  prompt?: string;
  storyId?: string;
  visibility?: "public" | "private";
  creatorId?: string;
};

export async function GET() {
  return NextResponse.json({ characters: localStore.characters });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CharacterPayload;
  const character = normalizeCharacter(body);
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    localStore.characters.unshift(character);
    return NextResponse.json(character);
  }

  const { data, error } = await supabase
    .from("characters")
    .insert({
      creator_id: body.creatorId ?? process.env.APP_DEMO_USER_ID ?? null,
      story_id: body.storyId || null,
      name: character.name,
      description: character.description,
      avatar_url: character.avatarUrl,
      personality: character.personality,
      speech_style: character.speechStyle,
      first_message: character.firstMessage,
      prompt: character.prompt,
      visibility: character.visibility
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...character, id: data.id });
}

function normalizeCharacter(body: CharacterPayload): Character {
  const name = clean(body.name) || "새 캐릭터";
  const relationship = clean(body.relationship);
  const prompt =
    clean(body.prompt) ||
    [
      `캐릭터 이름: ${name}`,
      `성격: ${clean(body.personality)}`,
      `말투: ${clean(body.speech_style)}`,
      relationship ? `관계와 기억: ${relationship}` : ""
    ]
      .filter(Boolean)
      .join("\n");

  return {
    id: slugId("character"),
    creatorId: body.creatorId ?? "demo-user",
    storyId: body.storyId || undefined,
    name,
    description: clean(body.description) || "아직 소개가 없습니다.",
    avatarUrl: clean(body.avatar_url) || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
    personality: clean(body.personality),
    speechStyle: clean(body.speech_style),
    firstMessage: clean(body.first_message) || `${name}이 당신을 바라본다.`,
    prompt,
    visibility: body.visibility ?? "private"
  };
}

function clean(value?: FormDataEntryValue | string) {
  return typeof value === "string" ? value.trim() : "";
}
