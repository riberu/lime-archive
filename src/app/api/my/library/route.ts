import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StoryWorkRow = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  visibility: "public" | "private";
  chat_count: number;
  created_at: string;
  updated_at: string | null;
};

type WorldWorkRow = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  visibility: "public" | "private";
  created_at: string;
  updated_at: string | null;
};

type CharacterWorkRow = {
  id: string;
  story_id: string | null;
  name: string;
  description: string;
  avatar_url: string | null;
  visibility: "public" | "private";
  created_at: string;
  updated_at: string | null;
};

type SessionRow = {
  id: string;
  story_id: string;
  title: string;
  updated_at: string | null;
  created_at: string;
  episode_state: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const [worldsResult, storiesResult, charactersResult, sessionsResult] = await Promise.all([
    supabase
      .from("worlds")
      .select("id, title, description, image_url, visibility, created_at, updated_at")
      .eq("creator_id", user.id)
      .order("updated_at", { ascending: false })
      .returns<WorldWorkRow[]>(),
    supabase
      .from("stories")
      .select("id, title, description, thumbnail_url, visibility, chat_count, created_at, updated_at")
      .eq("creator_id", user.id)
      .order("updated_at", { ascending: false })
      .returns<StoryWorkRow[]>(),
    supabase
      .from("characters")
      .select("id, story_id, name, description, avatar_url, visibility, created_at, updated_at, scope")
      .eq("creator_id", user.id)
      .or("scope.eq.independent,scope.is.null")
      .order("updated_at", { ascending: false })
      .returns<CharacterWorkRow[]>(),
    supabase
      .from("chat_sessions")
      .select("id, story_id, title, updated_at, created_at, episode_state")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .returns<SessionRow[]>()
  ]);

  if (worldsResult.error) return NextResponse.json({ error: worldsResult.error.message }, { status: 500 });
  if (storiesResult.error) return NextResponse.json({ error: storiesResult.error.message }, { status: 500 });
  if (charactersResult.error) return NextResponse.json({ error: charactersResult.error.message }, { status: 500 });
  if (sessionsResult.error) return NextResponse.json({ error: sessionsResult.error.message }, { status: 500 });

  const sessions = sessionsResult.data ?? [];
  const storyIds = [...new Set(sessions.map((session) => session.story_id))];
  const characterIds = [
    ...new Set(
      sessions
        .map((session) => getSessionCharacterId(session.episode_state))
        .filter((value): value is string => Boolean(value))
    )
  ];

  const [participatedStoriesResult, participatedCharactersResult] = await Promise.all([
    storyIds.length
      ? supabase
          .from("stories")
          .select("id, title, description, thumbnail_url, visibility, chat_count, created_at, updated_at")
          .in("id", storyIds)
          .returns<StoryWorkRow[]>()
      : Promise.resolve({ data: [] as StoryWorkRow[], error: null }),
    characterIds.length
      ? supabase
          .from("characters")
          .select("id, story_id, name, description, avatar_url, visibility, created_at, updated_at")
          .in("id", characterIds)
          .returns<CharacterWorkRow[]>()
      : Promise.resolve({ data: [] as CharacterWorkRow[], error: null })
  ]);

  if (participatedStoriesResult.error) return NextResponse.json({ error: participatedStoriesResult.error.message }, { status: 500 });
  if (participatedCharactersResult.error) return NextResponse.json({ error: participatedCharactersResult.error.message }, { status: 500 });

  const storyById = new Map((participatedStoriesResult.data ?? []).map((story) => [story.id, story]));
  const characterById = new Map((participatedCharactersResult.data ?? []).map((character) => [character.id, character]));

  const storyGroups = new Map<string, SessionRow[]>();
  const characterGroups = new Map<string, SessionRow[]>();
  for (const session of sessions) {
    const characterId = getSessionCharacterId(session.episode_state);
    if (characterId) {
      characterGroups.set(characterId, [...(characterGroups.get(characterId) ?? []), session]);
    } else {
      storyGroups.set(session.story_id, [...(storyGroups.get(session.story_id) ?? []), session]);
    }
  }

  return NextResponse.json({
    ownWorlds: (worldsResult.data ?? []).map(mapWorldWork),
    ownStories: (storiesResult.data ?? []).map(mapStoryWork),
    ownCharacters: (charactersResult.data ?? []).map(mapCharacterWork),
    participatedStories: [...storyGroups.entries()]
      .map(([storyId, groupedSessions]) => {
        const story = storyById.get(storyId);
        return story ? mapParticipationGroup(mapStoryWork(story), groupedSessions) : null;
      })
      .filter(Boolean),
    participatedCharacters: [...characterGroups.entries()]
      .map(([characterId, groupedSessions]) => {
        const character = characterById.get(characterId);
        return character ? mapParticipationGroup(mapCharacterWork(character), groupedSessions) : null;
      })
      .filter(Boolean)
  });
}

function mapWorldWork(world: WorldWorkRow) {
  return {
    id: world.id,
    type: "world" as const,
    title: world.title,
    description: world.description,
    imageUrl: world.image_url ?? "",
    visibility: world.visibility,
    chatCount: 0,
    updatedAt: world.updated_at ?? world.created_at
  };
}

function getSessionCharacterId(value: Record<string, unknown> | null) {
  const characterId = value?.characterId;
  return typeof characterId === "string" && characterId ? characterId : "";
}

function mapStoryWork(story: StoryWorkRow) {
  return {
    id: story.id,
    type: "story" as const,
    title: story.title,
    description: story.description,
    imageUrl: story.thumbnail_url ?? "",
    visibility: story.visibility,
    chatCount: story.chat_count,
    updatedAt: story.updated_at ?? story.created_at
  };
}

function mapCharacterWork(character: CharacterWorkRow) {
  return {
    id: character.id,
    type: "character" as const,
    title: character.name,
    description: character.description,
    imageUrl: character.avatar_url ?? "",
    visibility: character.visibility,
    storyId: character.story_id,
    chatCount: 0,
    updatedAt: character.updated_at ?? character.created_at
  };
}

function mapParticipationGroup(
  item: ReturnType<typeof mapStoryWork> | ReturnType<typeof mapCharacterWork>,
  sessions: SessionRow[]
) {
  const sortedSessions = [...sessions].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));
  return {
    item: {
      ...item,
      chatCount: sortedSessions.length,
      updatedAt: sortedSessions[0]?.updated_at ?? sortedSessions[0]?.created_at ?? item.updatedAt
    },
    sessions: sortedSessions.map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updated_at ?? session.created_at,
      pinned: Boolean(session.episode_state?.pinned)
    }))
  };
}
