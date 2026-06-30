import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type CharacterRow = {
  id: string;
  name: string;
  description: string;
  gender: string | null;
  age: string | null;
  avatar_url: string | null;
  personality: string;
  speech_style: string;
  first_message: string | null;
  prompt: string;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase
    .from("characters")
    .select("id, name, description, gender, age, avatar_url, personality, speech_style, first_message, prompt")
    .eq("creator_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<CharacterRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    characters: (data ?? []).map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      gender: character.gender ?? "",
      age: character.age ?? "",
      avatarUrl: character.avatar_url ?? "",
      personality: character.personality,
      speechStyle: character.speech_style,
      firstMessage: character.first_message ?? "",
      prompt: character.prompt
    }))
  });
}
