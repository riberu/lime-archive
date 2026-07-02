import { NextResponse } from "next/server";
import { accessCookieName, createAccessToken, isAccessGateEnabled } from "@/lib/access-gate";

type AccessPayload = {
  password?: string;
};

export async function POST(request: Request) {
  if (!isAccessGateEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json().catch(() => ({}))) as AccessPayload;
  const password = body.password?.trim() ?? "";
  const expected = process.env.SITE_ACCESS_PASSWORD?.trim() ?? "";

  if (!password || password !== expected) {
    return NextResponse.json({ error: "입장 암호가 맞지 않아요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessCookieName, createAccessToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/"
  });
  return response;
}
