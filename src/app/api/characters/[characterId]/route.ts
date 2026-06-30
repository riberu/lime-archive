import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";

type RouteContext = {
  params: Promise<{ characterId: string }>;
};

type CharacterUpdatePayload = {
  name?: string;
  description?: string;
  gender?: string;
  age?: string;
  avatar_url?: string;
  personality?: string;
  speech_style?: string;
  first_message?: string;
  prompt?: string;
  storyId?: string;
  worldId?: string;
  scope?: "independent" | "world";
  isEnabled?: boolean;
  visibility?: "public" | "private";
};

export async function PATCH(request: Request, context: RouteContext) {
  const { characterId } = await context.params;
  const body = (await request.json()) as CharacterUpdatePayload;
  const payload = normalizePayload(body);
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const character = localStore.characters.find((item) => item.id === characterId);
    if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });
    Object.assign(character, {
      name: payload.name ?? character.name,
      description: payload.description ?? character.description,
      gender: payload.gender ?? character.gender,
      age: payload.age ?? character.age,
      avatarUrl: payload.avatar_url ?? character.avatarUrl,
      personality: payload.personality ?? character.personality,
      speechStyle: payload.speech_style ?? character.speechStyle,
      firstMessage: payload.first_message ?? character.firstMessage,
      prompt: payload.prompt ?? character.prompt,
      storyId: payload.story_id ?? character.storyId,
      worldId: payload.world_id ?? character.worldId,
      scope: payload.scope ?? character.scope,
      isEnabled: payload.is_enabled ?? character.isEnabled,
      visibility: payload.visibility ?? character.visibility
    });
    return NextResponse.json(character);
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase
    .from("characters")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", characterId)
    .eq("creator_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { characterId } = await context.params;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const index = localStore.characters.findIndex((item) => item.id === characterId);
    if (index >= 0) localStore.characters.splice(index, 1);
    return NextResponse.json({ id: characterId });
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase.from("characters").delete().eq("id", characterId).eq("creator_id", user.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "삭제할 수 있는 작품을 찾지 못했어요." }, { status: 404 });
  return NextResponse.json({ id: characterId });
}

function normalizePayload(body: CharacterUpdatePayload) {
  return {
    name: clean(body.name),
    description: clean(body.description),
    gender: clean(body.gender),
    age: clean(body.age),
    avatar_url: clean(body.avatar_url),
    personality: clean(body.personality),
    speech_style: clean(body.speech_style),
    first_message: clean(body.first_message),
    prompt: clean(body.prompt),
    story_id: clean(body.storyId) || null,
    world_id: clean(body.worldId) || null,
    scope: body.scope,
    is_enabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
    visibility: body.visibility
  };
}

function clean(value?: string) {
  return typeof value === "string" ? value.trim() : undefined;
}
