import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensurePublicProfile(supabase: SupabaseClient, user: User) {
  const displayName = getUserDisplayName(user);
  const avatarUrl = getUserAvatarUrl(user);

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName || "New user",
      avatar_url: avatarUrl || null
    },
    { onConflict: "id" }
  );

  return error?.message ?? null;
}

export function getUserDisplayName(user: User | null) {
  if (!user) return "";
  const metadata = user.user_metadata as Record<string, unknown>;
  return String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "").trim();
}

export function getUserAvatarUrl(user: User | null) {
  if (!user) return "";
  const metadata = user.user_metadata as Record<string, unknown>;
  return String(metadata.avatar_url ?? metadata.picture ?? "").trim();
}
