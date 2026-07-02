import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getStories } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { normalizeStoryStartSettings, serializeStartSettingsForDb } from "@/lib/start-settings";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Story, StoryStartSetting } from "@/lib/types";

type StoryPayload = {
  title?: string;
  description?: string;
  tags?: string | string[];
  thumbnail_url?: string;
  category?: string;
  prompt_template?: string;
  world?: string;
  ai_rules?: string;
  characters?: string;
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
  system_prompt?: string;
  visibility?: "public" | "private";
  creatorId?: string;
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

export async function GET() {
  const stories = await getStories();
  return NextResponse.json({ stories });
}

export async function POST(request: Request) {
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body = isJson ? ((await request.json()) as StoryPayload) : formDataToStoryPayload(await request.formData());
  const story = normalizeStory(body);
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) {
    localStore.stories.unshift(story);
    if (!isJson) return NextResponse.redirect(new URL(`/stories/${story.id}`, request.url));
    return NextResponse.json(story);
  }

  if (!user) {
    if (!isJson) return NextResponse.redirect(new URL("/signup", request.url));
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      creator_id: user.id,
      title: story.title,
      description: story.description,
      thumbnail_url: story.thumbnailUrl,
      system_prompt: story.systemPrompt,
      opening_message: story.openingMessage,
      current_scene: story.currentScene,
      status_text: story.statusText,
      start_settings: serializeStartSettingsForDb(story.startSettings),
      tags: story.tags,
      visibility: story.visibility
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const characterError = await attachStoryCharacters(supabase, user.id, data.id, body.storyCharacters, story.visibility);
  if (characterError) {
    return NextResponse.json({ error: characterError }, { status: 500 });
  }

  if (!isJson) return NextResponse.redirect(new URL(`/stories/${data.id}`, request.url));
  return NextResponse.json({ ...story, id: data.id });
}

function formDataToStoryPayload(formData: FormData): StoryPayload {
  return {
    title: clean(formData.get("title")),
    description: clean(formData.get("description")),
    tags: clean(formData.get("tags")),
    thumbnail_url: clean(formData.get("thumbnail_url")),
    category: clean(formData.get("category")),
    prompt_template: clean(formData.get("prompt_template")),
    world: clean(formData.get("world")),
    ai_rules: clean(formData.get("ai_rules")),
    characters: clean(formData.get("characters")),
    opening_message: clean(formData.get("opening_message")),
    current_scene: clean(formData.get("current_scene")),
    status_text: clean(formData.get("status_text")),
    style_tone: clean(formData.get("style_tone")),
    forbidden_rules: clean(formData.get("forbidden_rules")),
    media_notes: clean(formData.get("media_notes")),
    storyboard: clean(formData.get("storyboard")),
    example_dialogues: clean(formData.get("example_dialogues")),
    ending_rules: clean(formData.get("ending_rules")),
    rating_note: clean(formData.get("rating_note")),
    system_prompt: clean(formData.get("system_prompt")),
    visibility: formData.get("visibility") === "public" ? "public" : "private"
  };
}

function normalizeStory(body: StoryPayload): Story {
  const title = clean(body.title) || "Untitled story";
  const assembledPrompt = buildSystemPrompt(body);
  const systemPrompt = clean(body.system_prompt) || assembledPrompt;
  const legacyStart = {
    openingMessage: clean(body.opening_message),
    currentScene: clean(body.current_scene),
    statusText: clean(body.status_text)
  };
  const startSettings = normalizeStoryStartSettings(body.startSettings, legacyStart);
  const primaryStart = startSettings.find((setting) => setting.mode === "scene");

  return {
    id: slugId("story"),
    creatorId: body.creatorId ?? "local-user",
    title,
    description: clean(body.description) || "No description yet.",
    thumbnailUrl: clean(body.thumbnail_url) || "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80",
    systemPrompt: systemPrompt || "능동적인 롤플레잉 게임마스터로서 장면을 멈추지 않고 자연스럽게 이어간다.",
    openingMessage: primaryStart?.openingMessage || legacyStart.openingMessage || `${title}의 첫 장면이 시작됩니다.`,
    currentScene: primaryStart?.currentScene || legacyStart.currentScene || "첫 장면이 시작되기 직전입니다.",
    statusText: primaryStart?.statusText || legacyStart.statusText || "#001 | 시작",
    startSettings,
    tags: parseTags(body.tags, body.category),
    visibility: body.visibility ?? "private",
    likeCount: 0,
    chatCount: 0,
    createdAt: nowIso()
  };
}

function parseTags(value?: string | string[], category?: string) {
  const categoryTags = splitTags(clean(category));
  const tags = Array.isArray(value)
    ? [...categoryTags, ...value.map((tag) => tag.trim())]
    : [...categoryTags, ...(value ?? "").split(",").map((tag) => tag.trim())];

  return [...new Set(tags.filter(Boolean))].slice(0, 10);
}

function clean(value?: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildSystemPrompt(body: StoryPayload) {
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
    .map(([sectionTitle, content]) => `${sectionTitle}\n${content}`)
    .join("\n\n");
}

function formatStoryCharactersForPrompt(characters?: StoryCharacterPayload[]) {
  if (!characters?.length) return "";
  return characters
    .map((character) => {
      const name = clean(character.name) || "Unnamed character";
      const lines = [
        `- ${name}`,
        clean(character.description) ? `  Description: ${clean(character.description)}` : "",
        clean(character.gender) ? `  Gender: ${clean(character.gender)}` : "",
        clean(character.age) ? `  Age: ${clean(character.age)}` : "",
        clean(character.personality) ? `  Personality: ${clean(character.personality)}` : "",
        clean(character.speechStyle) ? `  Speech style: ${clean(character.speechStyle)}` : "",
        clean(character.memo) ? `  Story memo: ${clean(character.memo)}` : "",
        clean(character.prompt) ? `  Prompt: ${clean(character.prompt)}` : ""
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

async function attachStoryCharacters(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  userId: string,
  storyId: string,
  characters: StoryCharacterPayload[] | undefined,
  visibility: "public" | "private"
) {
  if (!characters?.length) return "";

  const links: Array<{ story_id: string; character_id: string; role: string; role_note: string; sort_order: number }> = [];

  for (const [index, character] of characters.entries()) {
    const existingId = clean(character.characterId);
    if (character.source === "existing" && existingId) {
      const { data: existing, error } = await supabase
        .from("characters")
        .select("id")
        .eq("id", existingId)
        .eq("creator_id", userId)
        .maybeSingle<{ id: string }>();
      if (error) return error.message;
      if (existing?.id) {
        links.push({ story_id: storyId, character_id: existing.id, role: "base", role_note: clean(character.memo), sort_order: index });
      }
      continue;
    }

    const name = clean(character.name);
    if (!name) continue;
    const personality = clean(character.personality);
    const speechStyle = clean(character.speechStyle);
    const description = clean(character.description);
    const gender = clean(character.gender);
    const age = clean(character.age);
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
    if (created?.id) links.push({ story_id: storyId, character_id: created.id, role: "base", role_note: memo, sort_order: index });
  }

  if (!links.length) return "";
  const { error } = await supabase.from("story_characters").upsert(links, { onConflict: "story_id,character_id" });
  return error?.message ?? "";
}
