import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStories } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import type { Story } from "@/lib/types";

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
      tags: story.tags,
      visibility: story.visibility
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const systemPrompt =
    clean(body.system_prompt) ||
    assembledPrompt;

  return {
    id: slugId("story"),
    creatorId: body.creatorId ?? "local-user",
    title,
    description: clean(body.description) || "No description yet.",
    thumbnailUrl: clean(body.thumbnail_url) || "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80",
    systemPrompt: systemPrompt || "능동적인 롤플레잉 게임마스터로서 장면을 멈추지 않고 자연스럽게 이어간다.",
    openingMessage: clean(body.opening_message) || `${title} begins in a quiet scene.`,
    currentScene: clean(body.current_scene) || "The first scene is about to begin.",
    statusText: clean(body.status_text) || "#001 | Start",
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
    : [
        ...categoryTags,
        ...(value ?? "")
          .split(",")
          .map((tag) => tag.trim())
      ];

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
    ["# Characters", clean(body.characters)],
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
