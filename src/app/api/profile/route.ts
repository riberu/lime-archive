import { NextResponse } from "next/server";
import { getAccountRole } from "@/lib/admin";
import { getUserFromRequest } from "@/lib/auth";
import { ensurePublicProfile, getUserAvatarUrl, getUserDisplayName } from "@/lib/profile-sync";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ProfilePayload = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const defaultName = getUserDisplayName(user);
  const profileError = await ensurePublicProfile(supabase, user);
  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  const [{ data: profile }, { count: storyCount }, { count: characterCount }, followerCount, followingCount] = await Promise.all([
    supabase.from("app_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("characters").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    countFollows("following_id", user.id),
    countFollows("follower_id", user.id)
  ]);

  if (!profile) {
    await supabase.from("app_profiles").upsert(
      {
        id: user.id,
        display_name: defaultName,
        bio: "",
        avatar_url: getUserAvatarUrl(user),
        follower_count: followerCount ?? 0,
        following_count: followingCount ?? 0,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
  }

  return NextResponse.json({
    id: user.id,
    authenticated: true,
    email: user.email ?? "",
    role: getAccountRole(user.email),
    displayName: profile?.display_name ?? defaultName,
    bio: profile?.bio ?? "",
    avatarUrl: profile?.avatar_url ?? getUserAvatarUrl(user),
    followerCount: followerCount ?? profile?.follower_count ?? 0,
    followingCount: followingCount ?? profile?.following_count ?? 0,
    workCount: (storyCount ?? 0) + (characterCount ?? 0)
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as ProfilePayload;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase
    .from("app_profiles")
    .upsert(
      {
        id: user.id,
        display_name: body.displayName?.trim() || getUserDisplayName(user),
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
    id: user.id,
    authenticated: true,
    email: user.email ?? "",
    role: getAccountRole(user.email),
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url ?? "",
    followerCount: data.follower_count,
    followingCount: data.following_count
  });
}

async function countFollows(column: "follower_id" | "following_id", userId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { count, error } = await supabase.from("user_follows").select("*", { count: "exact", head: true }).eq(column, userId);
  if (error) return null;
  return count ?? 0;
}
