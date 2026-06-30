import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getWorlds } from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type WorldPayload = {
  title?: string;
  description?: string;
  rules?: string;
  image_url?: string;
  visibility?: "public" | "private";
};

export async function GET() {
  const worlds = await getWorlds();
  return NextResponse.json({ worlds });
}

export async function POST(request: Request) {
  const body = (await request.json()) as WorldPayload;
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const title = clean(body.title);
  if (!title) return NextResponse.json({ error: "세계관 이름을 입력해 주세요." }, { status: 400 });

  const { data, error } = await supabase
    .from("worlds")
    .insert({
      creator_id: user.id,
      title,
      description: clean(body.description),
      rules: clean(body.rules),
      image_url: clean(body.image_url) || "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80",
      visibility: "private"
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

function clean(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}
