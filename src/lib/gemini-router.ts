import { getSupabaseServerClient } from "@/lib/supabase/server";

const ASSIGNMENT_TTL_MINUTES = 30;

type GeminiPayload = {
  systemInstruction?: unknown;
  contents: unknown;
  generationConfig?: unknown;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type GeminiRoute = {
  apiKey: string;
  slotIndex: number;
};

export type GeminiGenerateResult =
  | { ok: true; data: GeminiResponse; slotIndex: number }
  | { ok: false; status: number; detail: string; slotIndex?: number };

export function getGeminiApiKeys() {
  const keys = [
    ...(process.env.GEMINI_API_KEYS ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY
  ]
    .map((key) => (key ?? "").trim())
    .filter(Boolean);

  return [...new Set(keys)];
}

export async function generateGeminiContent({
  model,
  payload,
  assignmentKey
}: {
  model: string;
  payload: GeminiPayload;
  assignmentKey: string;
}): Promise<GeminiGenerateResult> {
  const keys = getGeminiApiKeys();
  if (!keys.length) {
    return { ok: false, status: 500, detail: "GEMINI_API_KEY is missing." };
  }

  const primary = await resolveGeminiRoute(assignmentKey, keys);
  const routes = [
    primary,
    ...keys
      .map((apiKey, slotIndex) => ({ apiKey, slotIndex }))
      .filter((route) => route.slotIndex !== primary.slotIndex)
  ];

  let lastFailure: Exclude<GeminiGenerateResult, { ok: true }> | null = null;

  for (const route of routes) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": route.apiKey },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await touchGeminiAssignment(assignmentKey, route.slotIndex);
      return { ok: true, data: (await response.json()) as GeminiResponse, slotIndex: route.slotIndex };
    }

    const detail = await response.text().catch(() => "");
    lastFailure = { ok: false, status: response.status, detail, slotIndex: route.slotIndex };

    if (!isRetryableGeminiStatus(response.status)) {
      return lastFailure;
    }
  }

  return lastFailure ?? { ok: false, status: 502, detail: "Gemini request failed." };
}

async function resolveGeminiRoute(assignmentKey: string, keys: string[]): Promise<GeminiRoute> {
  const supabase = getSupabaseServerClient();
  const fallbackSlot = hashSlot(assignmentKey, keys.length);

  if (!supabase || !assignmentKey) {
    return { apiKey: keys[fallbackSlot], slotIndex: fallbackSlot };
  }

  try {
    const cutoff = activeCutoffIso();
    const { data: existing, error: existingError } = await supabase
      .from("gemini_api_assignments")
      .select("slot_index")
      .eq("assignment_key", assignmentKey)
      .gte("last_seen_at", cutoff)
      .maybeSingle<{ slot_index: number }>();

    if (existingError) throw existingError;

    if (typeof existing?.slot_index === "number" && keys[existing.slot_index]) {
      await touchGeminiAssignment(assignmentKey, existing.slot_index);
      return { apiKey: keys[existing.slot_index], slotIndex: existing.slot_index };
    }

    const slotIndex = await findLeastActiveSlot(keys.length);
    await touchGeminiAssignment(assignmentKey, slotIndex);
    return { apiKey: keys[slotIndex], slotIndex };
  } catch (error) {
    console.warn("Falling back to hash-based Gemini key routing", error);
    return { apiKey: keys[fallbackSlot], slotIndex: fallbackSlot };
  }
}

async function findLeastActiveSlot(slotCount: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const counts = Array.from({ length: slotCount }, () => 0);
  const { data, error } = await supabase
    .from("gemini_api_assignments")
    .select("slot_index")
    .gte("last_seen_at", activeCutoffIso())
    .returns<Array<{ slot_index: number }>>();

  if (error) throw error;

  for (const row of data ?? []) {
    if (Number.isInteger(row.slot_index) && row.slot_index >= 0 && row.slot_index < slotCount) {
      counts[row.slot_index] += 1;
    }
  }

  return counts.reduce((best, count, index) => (count < counts[best] ? index : best), 0);
}

async function touchGeminiAssignment(assignmentKey: string, slotIndex: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase || !assignmentKey) return;

  const { error } = await supabase.from("gemini_api_assignments").upsert(
    {
      assignment_key: assignmentKey,
      slot_index: slotIndex,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "assignment_key" }
  );

  if (error) console.warn("Failed to update Gemini key assignment", error);
}

function activeCutoffIso() {
  return new Date(Date.now() - ASSIGNMENT_TTL_MINUTES * 60 * 1000).toISOString();
}

function hashSlot(value: string, slotCount: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return slotCount ? hash % slotCount : 0;
}

function isRetryableGeminiStatus(status: number) {
  return status === 429 || status >= 500;
}
