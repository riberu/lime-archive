import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";

type RouteContext = {
  params: Promise<{ characterId: string }>;
};

type CharacterUpdatePayload = {
  name?: string;
  description?: string;
  avatar_url?: string;
  personality?: string;
  speech_style?: string;
  first_message?: string;
  prompt?: string;
  storyId?: string;
  visibility?: "public" | "private";
};

export async function PATCH(request: Request, context: RouteContext) {
  const { characterId } = await context.params;
  const body = (await request.json()) as CharacterUpdatePayload;
  const payload = normalizePayload(body);
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const character = localStore.characters.find((item) => item.id === characterId);
    if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });
    Object.assign(character, {
      name: payload.name ?? character.name,
      description: payload.description ?? character.description,
      avatarUrl: payload.avatar_url ?? character.avatarUrl,
      personality: payload.personality ?? character.personality,
      speechStyle: payload.speech_style ?? character.speechStyle,
      firstMessage: payload.first_message ?? character.firstMessage,
      prompt: payload.prompt ?? character.prompt,
      storyId: payload.story_id ?? character.storyId,
      visibility: payload.visibility ?? character.visibility
    });
    return NextResponse.json(character);
  }

  const { data, error } = await supabase
    .from("characters")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", characterId)
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { characterId } = await context.params;
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const index = localStore.characters.findIndex((item) => item.id === characterId);
    if (index >= 0) localStore.characters.splice(index, 1);
    return NextResponse.json({ id: characterId });
  }

  const { error } = await supabase.from("characters").delete().eq("id", characterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: characterId });
}

function normalizePayload(body: CharacterUpdatePayload) {
  return {
    name: clean(body.name),
    description: clean(body.description),
    avatar_url: clean(body.avatar_url),
    personality: clean(body.personality),
    speech_style: clean(body.speech_style),
    first_message: clean(body.first_message),
    prompt: clean(body.prompt),
    story_id: clean(body.storyId) || null,
    visibility: body.visibility
  };
}

function clean(value?: string) {
  return typeof value === "string" ? value.trim() : undefined;
}
