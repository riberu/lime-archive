import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuthorProfile = {
  id: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  followerCount: number;
  followingCount: number;
};

type AppProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
};

export async function getAuthorProfile(authorId: string): Promise<AuthorProfile | null> {
  if (!authorId || authorId === "anonymous") return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from("app_profiles").select("*").eq("id", authorId).maybeSingle<AppProfileRow>();
  const [followerCount, followingCount] = await Promise.all([
    countFollows("following_id", authorId),
    countFollows("follower_id", authorId)
  ]);

  if (data) {
    return {
      id: authorId,
      displayName: data.display_name || "작가",
      avatarUrl: data.avatar_url ?? "",
      bio: data.bio ?? "",
      followerCount: followerCount ?? data.follower_count ?? 0,
      followingCount: followingCount ?? data.following_count ?? 0
    };
  }

  const { data: profile } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", authorId).maybeSingle<{
    id: string;
    display_name: string;
    avatar_url: string | null;
  }>();

  if (!profile) return null;
  return {
    id: authorId,
    displayName: profile.display_name || "작가",
    avatarUrl: profile.avatar_url ?? "",
    bio: "",
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0
  };
}

async function countFollows(column: "follower_id" | "following_id", userId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { count, error } = await supabase.from("user_follows").select("*", { count: "exact", head: true }).eq(column, userId);
  if (error) return null;
  return count ?? 0;
}
