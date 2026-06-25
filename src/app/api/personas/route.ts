import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDefaultPersonas, type UserPersona } from "@/lib/personas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type PersonaRow = {
  id: string;
  name: string;
  appearance: string;
  speech_style: string;
  memo: string;
  is_default: boolean;
};

type PersonaPayload = {
  id?: string;
  name?: string;
  appearance?: string;
  speechStyle?: string;
  memo?: string;
  isDefault?: boolean;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase || !user) return NextResponse.json({ personas: [], authenticated: Boolean(user) }, { status: user ? 200 : 401 });

  const { data, error } = await supabase
    .from("user_personas")
    .select("id, name, appearance, speech_style, memo, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: formatPersonaError(error.message, error.code) }, { status: 500 });

  if (!data.length) {
    try {
      const seeded = await seedDefaultPersona(user.id);
      return NextResponse.json({ personas: seeded, authenticated: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "기본 페르소나 생성에 실패했습니다." }, { status: 500 });
    }
  }

  return NextResponse.json({ personas: data.map(rowToPersona), authenticated: true });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);
  const body = (await request.json()) as PersonaPayload;

  if (!supabase || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = body.id && body.id !== "default-persona" ? body.id : crypto.randomUUID();
  const isDefault = Boolean(body.isDefault);

  if (isDefault) {
    await supabase.from("user_personas").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await supabase
    .from("user_personas")
    .upsert(
      {
        id,
        user_id: user.id,
        name: clean(body.name),
        appearance: clean(body.appearance),
        speech_style: clean(body.speechStyle),
        memo: clean(body.memo),
        is_default: isDefault,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("id, name, appearance, speech_style, memo, is_default")
    .single<PersonaRow>();

  if (error) return NextResponse.json({ error: formatPersonaError(error.message, error.code) }, { status: 500 });

  return NextResponse.json({ persona: rowToPersona(data) });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!supabase || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!id) return NextResponse.json({ error: "삭제할 페르소나가 없습니다." }, { status: 400 });

  const { error } = await supabase.from("user_personas").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: formatPersonaError(error.message, error.code) }, { status: 500 });

  const { data } = await supabase
    .from("user_personas")
    .select("id, name, appearance, speech_style, memo, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (!data?.some((row) => row.is_default) && data?.[0]) {
    await supabase.from("user_personas").update({ is_default: true }).eq("id", data[0].id).eq("user_id", user.id);
    data[0].is_default = true;
  }

  return NextResponse.json({ personas: (data ?? []).map(rowToPersona) });
}

async function seedDefaultPersona(userId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return getDefaultPersonas();

  const defaults = getDefaultPersonas().map((persona) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name: persona.name,
    appearance: persona.appearance,
    speech_style: persona.speechStyle,
    memo: persona.memo,
    is_default: true
  }));

  const { data, error } = await supabase
    .from("user_personas")
    .insert(defaults)
    .select("id, name, appearance, speech_style, memo, is_default");

  if (error) throw new Error(formatPersonaError(error.message, error.code));
  if (!data) return getDefaultPersonas();
  return data.map(rowToPersona);
}

function rowToPersona(row: PersonaRow): UserPersona {
  return {
    id: row.id,
    name: row.name,
    appearance: row.appearance,
    speechStyle: row.speech_style,
    memo: row.memo,
    isDefault: row.is_default
  };
}

function clean(value?: string) {
  return value?.trim() ?? "";
}

function formatPersonaError(message: string, code?: string) {
  if (code === "PGRST205" || message.includes("schema cache")) {
    return "Supabase REST 스키마 캐시에 user_personas 테이블이 없습니다. apply-user-account.sql을 실행한 뒤 Supabase Data API 스키마 캐시를 새로고침해 주세요.";
  }
  return message;
}
