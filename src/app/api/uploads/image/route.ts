import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxUploadSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");
  const usage = normalizeUsage(formData.get("usage"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "Only jpg, png, webp, and gif images are supported" }, { status: 400 });
  }

  if (file.size > maxUploadSize) {
    return NextResponse.json({ error: "Image must be 8MB or smaller" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      url: `data:${file.type};base64,${bytes.toString("base64")}`,
      path: null,
      mode: "preview"
    });
  }

  const extension = getExtension(file);
  const path = `${usage}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("story-assets").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const { data } = supabase.storage.from("story-assets").getPublicUrl(path);

  return NextResponse.json({
    url: data.publicUrl,
    path,
    mode: "storage"
  });
}

function normalizeUsage(value: FormDataEntryValue | null) {
  return value === "character" ? "characters" : "stories";
}

function getExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}
