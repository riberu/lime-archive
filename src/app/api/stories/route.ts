import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
  return NextResponse.json({ stories: localStore.stories });
}

export async function POST(request: Request) {
  const body = (await request.json()) as StoryPayload;
  const story = normalizeStory(body);
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    localStore.stories.unshift(story);
    return NextResponse.json(story);
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      creator_id: body.creatorId ?? process.env.APP_DEMO_USER_ID ?? null,
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

  return NextResponse.json({ ...story, id: data.id });
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
    systemPrompt: systemPrompt || "Act as an active roleplay game master who continuously develops the scene.",
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
  const categoryTag = clean(category);
  if (Array.isArray(value)) {
    return [categoryTag, ...value.map((tag) => tag.trim())].filter(Boolean).slice(0, 10);
  }

  return [categoryTag, ...(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)]
    .slice(0, 10);
}

function clean(value?: FormDataEntryValue | string) {
  return typeof value === "string" ? value.trim() : "";
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
