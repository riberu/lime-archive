import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim().replace(/^\uFEFF/, ""), line.slice(index + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or server key is missing in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const dmaStoryId = "73a3be1a-c3e7-41d4-9e09-d1b9ad9b731e";
const characterImages = {
  백려: "/images/dma/characters/baekryeo.png",
  묵유: "/images/dma/characters/mukyu.png",
  금황: "/images/dma/characters/geumhwang.png",
  청룡: "/images/dma/characters/cheongryong.png",
  카민: "/images/dma/characters/kamin.png",
  시칠: "/images/dma/characters/sichil.png",
  청준: "/images/dma/characters/cheongjun.png",
  스파인: "/images/dma/characters/spine.png",
  비시: "/images/dma/characters/bisi.png",
  페이: "/images/dma/characters/pei.png"
};

for (const [name, avatarUrl] of Object.entries(characterImages)) {
  const { data, error } = await supabase
    .from("characters")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("story_id", dmaStoryId)
    .eq("name", name)
    .select("id,name,avatar_url")
    .single();

  if (error) throw new Error(`${name} 이미지 업데이트 실패: ${error.message}`);
  console.log(`${data.name}: ${data.avatar_url}`);
}
