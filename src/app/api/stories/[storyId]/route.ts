import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore } from "@/lib/local-store";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

type StoryUpdatePayload = {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  system_prompt?: string;
  opening_message?: string;
  current_scene?: string;
  status_text?: string;
  tags?: string | string[];
  visibility?: "public" | "private";
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
  return {
    title: clean(body.title),
    description: clean(body.description),
    thumbnail_url: clean(body.thumbnail_url),
    system_prompt: clean(body.system_prompt),
    opening_message: clean(body.opening_message),
    current_scene: clean(body.current_scene),
    status_text: clean(body.status_text),
    tags: parseTags(body.tags),
    visibility: body.visibility
  };
}

function parseTags(value?: string | string[]) {
  if (Array.isArray(value)) return value.map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
  return (value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
}

function clean(value?: string) {
  return typeof value === "string" ? value.trim() : undefined;
}
