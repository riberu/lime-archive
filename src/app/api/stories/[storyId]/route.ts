import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";
import { normalizeStoryStartSettings, serializeStartSettingsForDb } from "@/lib/start-settings";
import type { StoryStartSetting } from "@/lib/types";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

type StoryUpdatePayload = {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  category?: string;
  prompt_template?: string;
  world?: string;
  ai_rules?: string;
  characters?: string;
  system_prompt?: string;
  opening_message?: string;
  current_scene?: string;
  status_text?: string;
  style_tone?: string;
  forbidden_rules?: string;
  media_notes?: string;
  storyboard?: string;
  example_dialogues?: string;
  ending_rules?: string;
  rating_note?: string;
  tags?: string | string[];
  visibility?: "public" | "private";
  storyCharacters?: StoryCharacterPayload[];
  startSettings?: StoryStartSetting[];
};

type StoryCharacterPayload = {
  source?: "existing" | "new";
  characterId?: string;
  name?: string;
  description?: string;
  gender?: string;
  age?: string;
  personality?: string;
  speechStyle?: string;
  memo?: string;
  prompt?: string;
  avatarUrl?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { storyId } = await context.params;
  const body = (await request.json()) as StoryUpdatePayload;
  const payload = normalizePayload(body);
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const story = localStore.stories.find((item) => item.id === storyId);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    Object.assign(story, {
      title: payload.title ?? story.title,
      description: payload.description ?? story.description,
      thumbnailUrl: payload.thumbnail_url ?? story.thumbnailUrl,
      systemPrompt: payload.system_prompt ?? story.systemPrompt,
      openingMessage: payload.opening_message ?? story.openingMessage,
      currentScene: payload.current_scene ?? story.currentScene,
      statusText: payload.status_text ?? story.statusText,
      startSettings: payload.start_settings ? normalizeStoryStartSettings(payload.start_settings) : story.startSettings,
      tags: payload.tags ?? story.tags,
      visibility: payload.visibility ?? story.visibility
    });
    return NextResponse.json(story);
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase
    .from("stories")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", storyId)
    .eq("creator_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const characterError = await replaceStoryCharacters(supabase, user.id, storyId, body.storyCharacters, payload.visibility ?? "private");
  if (characterError) return NextResponse.json({ error: characterError }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { storyId } = await context.params;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    const index = localStore.stories.findIndex((item) => item.id === storyId);
    if (index >= 0) localStore.stories.splice(index, 1);
    return NextResponse.json({ id: storyId });
  }

  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase.from("stories").delete().eq("id", storyId).eq("creator_id", user.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "삭제할 수 있는 작품을 찾지 못했어요." }, { status: 404 });
  return NextResponse.json({ id: storyId });
}

function normalizePayload(body: StoryUpdatePayload) {
  const legacyStart = {
    openingMessage: clean(body.opening_message),
    currentScene: clean(body.current_scene),
    statusText: clean(body.status_text)
  };
  const startSettings = body.startSettings ? normalizeStoryStartSettings(body.startSettings, legacyStart) : null;
  const primaryStart = startSettings?.find((setting) => setting.mode === "scene");

  return {
    title: clean(body.title),
    description: clean(body.description),
    thumbnail_url: clean(body.thumbnail_url),
    system_prompt: clean(body.system_prompt) || buildSystemPrompt(body),
    opening_message: primaryStart?.openingMessage ?? legacyStart.openingMessage,
    current_scene: primaryStart?.currentScene ?? legacyStart.currentScene,
    status_text: primaryStart?.statusText ?? legacyStart.statusText,
    start_settings: startSettings ? serializeStartSettingsForDb(startSettings) : undefined,
    tags: parseTags(body.tags, body.category),
    visibility: body.visibility
  };
}

function parseTags(value?: string | string[], category?: string) {
  const categoryTags = splitTags(clean(category));
  const tags = Array.isArray(value)
    ? [...categoryTags, ...value.map((tag) => tag.trim())]
    : [...categoryTags, ...splitTags(value ?? "")];
  return [...new Set(tags.filter(Boolean))].slice(0, 10);
}

function clean(value?: string) {
  return typeof value === "string" ? value.trim() : undefined;
}

function splitTags(value?: string) {
  return (value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function buildSystemPrompt(body: StoryUpdatePayload) {
  const sections = [
    ["# Prompt Template", clean(body.prompt_template)],
    ["# World", clean(body.world)],
    ["# AI Rules", clean(body.ai_rules)],
    ["# Characters", [clean(body.characters), formatStoryCharactersForPrompt(body.storyCharacters)].filter(Boolean).join("\n\n")],
    ["# Style Tone", clean(body.style_tone)],
    ["# Forbidden Rules", clean(body.forbidden_rules)],
    ["# Media Notes", clean(body.media_notes)],
    ["# Storyboard", clean(body.storyboard)],
    ["# Example Dialogues", clean(body.example_dialogues)],
    ["# Ending Rules", clean(body.ending_rules)],
    ["# Rating / Operation Note", clean(body.rating_note)]
  ];

  return sections
    .filter(([, content]) => content)
    .map(([title, content]) => `${title}\n${content}`)
    .join("\n\n");
}

function formatStoryCharactersForPrompt(characters?: StoryCharacterPayload[]) {
  if (!characters?.length) return "";
  return characters
    .map((character) => {
      const name = clean(character.name) || "Unnamed character";
      return [
        `- ${name}`,
        clean(character.description) ? `  Description: ${clean(character.description)}` : "",
        clean(character.gender) ? `  Gender: ${clean(character.gender)}` : "",
        clean(character.age) ? `  Age: ${clean(character.age)}` : "",
        clean(character.personality) ? `  Personality: ${clean(character.personality)}` : "",
        clean(character.speechStyle) ? `  Speech style: ${clean(character.speechStyle)}` : "",
        clean(character.memo) ? `  Story memo: ${clean(character.memo)}` : "",
        clean(character.prompt) ? `  Prompt: ${clean(character.prompt)}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

async function replaceStoryCharacters(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  userId: string,
  storyId: string,
  characters: StoryCharacterPayload[] | undefined,
  visibility: "public" | "private"
) {
  if (!characters) return "";

  const links: Array<{ story_id: string; character_id: string; role: string; role_note: string; sort_order: number }> = [];

  for (const [index, character] of characters.entries()) {
    const existingId = clean(character.characterId);
    if (character.source === "existing" && existingId) {
      const { data: existing, error } = await supabase
        .from("characters")
        .select("id, creator_id, story_id")
        .eq("id", existingId)
        .or(`creator_id.eq.${userId},story_id.eq.${storyId}`)
        .maybeSingle<{ id: string; creator_id: string | null; story_id: string | null }>();
      if (error) return error.message;
      if (existing?.id) {
        const updateError = await updateStoryCharacterRow(supabase, existing.id, storyId, userId, character, visibility);
        if (updateError) return updateError;
        links.push({ story_id: storyId, character_id: existing.id, role: "base", role_note: clean(character.memo) ?? "", sort_order: index });
      }
      continue;
    }

    const name = clean(character.name);
    if (!name) continue;
    const description = clean(character.description);
    const gender = clean(character.gender);
    const age = clean(character.age);
    const personality = clean(character.personality);
    const speechStyle = clean(character.speechStyle);
    const memo = clean(character.memo);
    const prompt =
      clean(character.prompt) ||
      [
        `Character name: ${name}`,
        description ? `Description: ${description}` : "",
        gender ? `Gender: ${gender}` : "",
        age ? `Age: ${age}` : "",
        personality ? `Personality: ${personality}` : "",
        speechStyle ? `Speech style: ${speechStyle}` : "",
        memo ? `Story memo: ${memo}` : ""
      ]
        .filter(Boolean)
        .join("\n");

    const { data: created, error } = await supabase
      .from("characters")
      .insert({
        creator_id: userId,
        story_id: storyId,
        name,
        description: description || "No description yet.",
        gender,
        age,
        avatar_url: clean(character.avatarUrl) || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
        personality,
        speech_style: speechStyle,
        first_message: "",
        prompt,
        visibility
      })
      .select("id")
      .single<{ id: string }>();
    if (error) return error.message;
    if (created?.id) links.push({ story_id: storyId, character_id: created.id, role: "base", role_note: memo ?? "", sort_order: index });
  }

  const keepIds = links.map((link) => link.character_id);
  if (keepIds.length) {
    const { error: deleteError } = await supabase.from("story_characters").delete().eq("story_id", storyId).not("character_id", "in", `(${keepIds.join(",")})`);
    if (deleteError) return deleteError.message;
    const { error: upsertError } = await supabase.from("story_characters").upsert(links, { onConflict: "story_id,character_id" });
    if (upsertError) return upsertError.message;
    return await removeUnlinkedStoryCharacterRows(supabase, storyId, keepIds);
  }

  const { error } = await supabase.from("story_characters").delete().eq("story_id", storyId);
  if (error) return error.message;
  return await removeUnlinkedStoryCharacterRows(supabase, storyId, []);
}

async function updateStoryCharacterRow(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  characterId: string,
  storyId: string,
  userId: string,
  character: StoryCharacterPayload,
  visibility: "public" | "private"
) {
  if (!supabase) return "";
  const name = clean(character.name) ?? "";
  if (!name) return "";
  const description = clean(character.description) ?? "";
  const gender = clean(character.gender) ?? "";
  const age = clean(character.age) ?? "";
  const personality = clean(character.personality) ?? "";
  const speechStyle = clean(character.speechStyle) ?? "";
  const memo = clean(character.memo) ?? "";
  const prompt =
    clean(character.prompt) ||
    [
      `Character name: ${name}`,
      description ? `Description: ${description}` : "",
      gender ? `Gender: ${gender}` : "",
      age ? `Age: ${age}` : "",
      personality ? `Personality: ${personality}` : "",
      speechStyle ? `Speech style: ${speechStyle}` : "",
      memo ? `Story memo: ${memo}` : ""
    ]
      .filter(Boolean)
      .join("\n");

  const update: Record<string, string | null> = {
    name,
    description: description || "No description yet.",
    gender,
    age,
    personality,
    speech_style: speechStyle,
    prompt,
    visibility,
    updated_at: new Date().toISOString()
  };
  const avatarUrl = clean(character.avatarUrl) ?? "";
  if (avatarUrl) update.avatar_url = avatarUrl;

  const { error } = await supabase
    .from("characters")
    .update(update)
    .eq("id", characterId)
    .or(`creator_id.eq.${userId},story_id.eq.${storyId}`);
  return error?.message ?? "";
}

async function removeUnlinkedStoryCharacterRows(supabase: ReturnType<typeof getSupabaseServerClient>, storyId: string, keepIds: string[]) {
  if (!supabase) return "";
  let query = supabase.from("characters").delete().eq("story_id", storyId);
  if (keepIds.length) query = query.not("id", "in", `(${keepIds.join(",")})`);
  const { error } = await query;
  return error?.message ?? "";
}
