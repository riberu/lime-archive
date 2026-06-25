import { NextResponse } from "next/server";
import { clearLocalStore } from "@/lib/local-store";

export async function DELETE() {
  clearLocalStore();
  return NextResponse.json({ ok: true });
}
