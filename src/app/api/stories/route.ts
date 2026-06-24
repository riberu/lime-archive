import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import type { Story } from "@/lib/types";

type StoryPayload = {
  title?: string;
  description?: string;
  tags?: string | string[];
  thumbnail_url?: string;
  world?: string;
  ai_rules?: string;
  characters?: string;
  opening_message?: string;
  current_scene?: string;
  status_text?: string;
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
  const world = clean(body.world);
  const aiRules = clean(body.ai_rules);
  const characters = clean(body.characters);
  const systemPrompt =
    clean(body.system_prompt) ||
    ["# World", world, "# AI Rules", aiRules, "# Characters", characters].filter(Boolean).join("\n\n");

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
    tags: parseTags(body.tags),
    visibility: body.visibility ?? "private",
    likeCount: 0,
    chatCount: 0,
    createdAt: nowIso()
  };
}

function parseTags(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
  }

  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function clean(value?: FormDataEntryValue | string) {
  return typeof value === "string" ? value.trim() : "";
}
