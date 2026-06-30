import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCharacters } from "@/lib/data";
import { localStore, slugId } from "@/lib/local-store";
import type { Character } from "@/lib/types";

type CharacterPayload = {
  name?: string;
  description?: string;
  gender?: string;
  age?: string;
  avatar_url?: string;
  personality?: string;
  speech_style?: string;
  character_tags?: string;
  relationship?: string;
  first_message?: string;
  intro_scene?: string;
  memory_rules?: string;
  response_rules?: string;
  prompt?: string;
  storyId?: string;
  worldId?: string;
  scope?: "independent" | "world";
  visibility?: "public" | "private";
  creatorId?: string;
};

export async function GET() {
  const characters = await getCharacters();
  return NextResponse.json({ characters });
}

export async function POST(request: Request) {
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body = isJson ? ((await request.json()) as CharacterPayload) : formDataToCharacterPayload(await request.formData());
  const character = normalizeCharacter(body);
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    localStore.characters.unshift(character);
    if (!isJson) return NextResponse.redirect(new URL(`/characters/${character.id}`, request.url));
    return NextResponse.json(character);
  }

  if (!user) {
    if (!isJson) return NextResponse.redirect(new URL("/signup", request.url));
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("characters")
    .insert({
      creator_id: user.id,
      story_id: body.storyId || null,
      world_id: body.worldId || null,
      scope: body.scope === "world" ? "world" : "independent",
      is_enabled: true,
      name: character.name,
      description: character.description,
      gender: character.gender,
      age: character.age,
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

  if (!isJson) return NextResponse.redirect(new URL(`/characters/${data.id}`, request.url));
  return NextResponse.json({ ...character, id: data.id });
}

function formDataToCharacterPayload(formData: FormData): CharacterPayload {
  return {
    name: clean(formData.get("name")),
    description: clean(formData.get("description")),
    gender: clean(formData.get("gender")),
    age: clean(formData.get("age")),
    avatar_url: clean(formData.get("avatar_url")),
    personality: clean(formData.get("personality")),
    speech_style: clean(formData.get("speech_style")),
    character_tags: clean(formData.get("character_tags")),
    relationship: clean(formData.get("relationship")),
    first_message: clean(formData.get("first_message")),
    intro_scene: clean(formData.get("intro_scene")),
    memory_rules: clean(formData.get("memory_rules")),
    response_rules: clean(formData.get("response_rules")),
    prompt: clean(formData.get("prompt")),
    storyId: clean(formData.get("storyId")),
    worldId: clean(formData.get("worldId")),
    scope: formData.get("scope") === "world" ? "world" : "independent",
    visibility: formData.get("visibility") === "public" ? "public" : "private"
  };
}

function normalizeCharacter(body: CharacterPayload): Character {
  const name = clean(body.name) || "New character";
  const relationship = clean(body.relationship);
  const prompt =
    clean(body.prompt) ||
    [
      `Character name: ${name}`,
      `Gender: ${clean(body.gender)}`,
      `Age: ${clean(body.age)}`,
      `Character tags: ${clean(body.character_tags)}`,
      `Intro scene: ${clean(body.intro_scene)}`,
      `Personality: ${clean(body.personality)}`,
      `Speech style: ${clean(body.speech_style)}`,
      relationship ? `Relationship memory: ${relationship}` : "",
      `Memory rules: ${clean(body.memory_rules)}`,
      `Response rules: ${clean(body.response_rules)}`
    ]
      .filter(Boolean)
      .join("\n");

  return {
    id: slugId("character"),
    creatorId: body.creatorId ?? "local-user",
    storyId: body.storyId || undefined,
    worldId: body.worldId || undefined,
    scope: body.scope === "world" ? "world" : "independent",
    isEnabled: true,
    name,
    description: clean(body.description) || "No description yet.",
    gender: clean(body.gender),
    age: clean(body.age),
    avatarUrl: clean(body.avatar_url) || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
    personality: clean(body.personality),
    speechStyle: clean(body.speech_style),
    firstMessage: clean(body.first_message) || `${name} looks at you quietly.`,
    prompt,
    visibility: body.visibility ?? "private"
  };
}

function clean(value?: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim() : "";
}
