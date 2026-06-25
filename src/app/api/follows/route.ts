import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ensurePublicProfile } from "@/lib/profile-sync";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type FollowPayload = {
  authorId?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authorId = url.searchParams.get("authorId") ?? "";
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!authorId) return NextResponse.json({ error: "작가 정보가 없습니다." }, { status: 400 });

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", authorId),
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", authorId)
  ]);

  let following = false;
  if (user) {
    const { data } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", authorId)
      .maybeSingle();
    following = Boolean(data);
  }

  return NextResponse.json({
    following,
    isSelf: user?.id === authorId,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as FollowPayload;
  const authorId = body.authorId ?? "";
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!authorId) return NextResponse.json({ error: "작가 정보가 없습니다." }, { status: 400 });
  if (authorId === user.id) return NextResponse.json({ error: "자기 자신은 팔로우할 수 없어요." }, { status: 400 });

  const profileError = await ensurePublicProfile(supabase, user);
  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  const { error } = await supabase.from("user_follows").upsert(
    {
      follower_id: user.id,
      following_id: authorId
    },
    { onConflict: "follower_id,following_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts = await updateProfileFollowCounts(user.id, authorId);
  return NextResponse.json({ following: true, ...counts });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const authorId = url.searchParams.get("authorId") ?? "";
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!authorId) return NextResponse.json({ error: "작가 정보가 없습니다." }, { status: 400 });

  const { error } = await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", authorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts = await updateProfileFollowCounts(user.id, authorId);
  return NextResponse.json({ following: false, ...counts });
}

async function updateProfileFollowCounts(followerId: string, followingId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { followerCount: 0, followingCount: 0 };

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", followingId),
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", followerId)
  ]);

  await Promise.all([
    supabase.from("app_profiles").update({ follower_count: followerCount ?? 0, updated_at: new Date().toISOString() }).eq("id", followingId),
    supabase.from("app_profiles").update({ following_count: followingCount ?? 0, updated_at: new Date().toISOString() }).eq("id", followerId)
  ]);

  return {
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0
  };
}
