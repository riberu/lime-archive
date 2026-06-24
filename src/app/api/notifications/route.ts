import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey");
  const supabase = getSupabaseServerClient();

  const fallback = [
    {
      id: "attendance",
      category: "attendance",
      title: "오늘 출석 알림",
      body: "하루 한 번 접속하면 출석 보상을 받을 수 있게 연결할 예정입니다.",
      href: "/profile",
      readAt: null,
      createdAt: new Date().toISOString()
    },
    {
      id: "notice",
      category: "notice",
      title: "라임 공지사항",
      body: "새 스토리 제작 기능과 알림 기능을 준비 중입니다.",
      href: "/stories",
      readAt: null,
      createdAt: new Date().toISOString()
    }
  ];

  if (!supabase) return NextResponse.json({ notifications: fallback });

  let query = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
  if (userKey) query = query.or(`user_key.is.null,user_key.eq.${userKey}`);
  else query = query.is("user_key", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ notifications: fallback });

  const notifications = data.length
    ? data.map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
        body: item.body,
        href: item.href,
        readAt: item.read_at,
        createdAt: item.created_at
      }))
    : fallback;

  return NextResponse.json({ notifications });
}
