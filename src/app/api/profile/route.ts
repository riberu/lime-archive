import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const profileId = "default";

type ProfilePayload = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      id: profileId,
      displayName: "",
      bio: "",
      avatarUrl: "",
      followerCount: 0,
      followingCount: 0,
      workCount: 0
    });
  }

  const [{ data: profile }, { count: storyCount }, { count: characterCount }] = await Promise.all([
    supabase.from("app_profiles").select("*").eq("id", profileId).maybeSingle(),
    supabase.from("stories").select("id", { count: "exact", head: true }),
    supabase.from("characters").select("id", { count: "exact", head: true })
  ]);

  return NextResponse.json({
    id: profileId,
    displayName: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    avatarUrl: profile?.avatar_url ?? "",
    followerCount: profile?.follower_count ?? 0,
    followingCount: profile?.following_count ?? 0,
    workCount: (storyCount ?? 0) + (characterCount ?? 0)
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as ProfilePayload;
  const supabase = getSupabaseServerClient();

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from("app_profiles")
    .upsert(
      {
        id: profileId,
        display_name: body.displayName?.trim() ?? "",
        bio: body.bio?.trim() ?? "",
        avatar_url: body.avatarUrl?.trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: profileId,
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url ?? "",
    followerCount: data.follower_count,
    followingCount: data.following_count
  });
}
