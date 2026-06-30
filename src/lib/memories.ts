import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import type { Character, MemoryEntry, MemoryEntryType } from "@/lib/types";

export const memoryTypes = ["short", "long", "character", "location"] as const satisfies readonly MemoryEntryType[];
const BASE_CHARACTER_TAG = "base-character";
const GENERATED_CHARACTER_TAG = "generated-character";
const MEMORY_VERSION_TAG = "memory-v2";
const BASE_CHARACTER_CONTENT = "";

type MemoryRow = {
  id: string;
  session_id: string;
  type: MemoryEntryType;
  episode_no: number | null;
  subject_key: string | null;
  title: string;
  content: string;
  tags: string[] | null;
  importance: number;
  created_at: string;
  updated_at: string;
};

export type MemoryInput = {
  sessionId: string;
  type: MemoryEntryType;
  episodeNo?: number;
  subjectKey?: string;
  title?: string;
  content: string;
  tags?: string[];
  importance?: number;
};

export type EventPlan = {
  event?: string;
  eventKeywords?: string[];
  worldImpact?: string;
  worldImpactKeywords?: string[];
  nextIncident?: string;
  nextIncidentKeywords?: string[];
  activeCharacters?: string[];
  silentCharacters?: string[];
  forbiddenSpeakers?: string[];
  characterMemories?: Array<{
    name?: string;
    relationshipToProtagonist?: string;
    relationshipKeywords?: string[];
    psychology?: string;
    psychologyKeywords?: string[];
    changed?: boolean;
    confidence?: number;
  }>;
  locationMemory?: {
    name?: string;
    summary?: string;
    memoryKeywords?: string[];
    changed?: boolean;
    confidence?: number;
  };
};

export function isMemoryType(value: string): value is MemoryEntryType {
  return memoryTypes.includes(value as MemoryEntryType);
}

export function normalizeMemorySubject(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function listMemories(sessionId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return localStore.memories
      .filter((memory) => memory.sessionId === sessionId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await supabase
    .from("memory_entries")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false })
    .returns<MemoryRow[]>();

  if (error) {
    console.error("Failed to load memories", error);
    return [];
  }

  return (data ?? []).map(mapMemory);
}

export async function createMemory(input: MemoryInput) {
  const supabase = getSupabaseServerClient();
  const payload = normalizeMemoryInput(input);

  if (!supabase) {
    const memory: MemoryEntry = {
      id: slugId("memory"),
      sessionId: payload.sessionId,
      type: payload.type,
      episodeNo: payload.episodeNo,
      subjectKey: payload.subjectKey,
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      importance: payload.importance,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    localStore.memories.unshift(memory);
    trimShortMemories(payload.sessionId);
    return memory;
  }

  const { data, error } = await supabase
    .from("memory_entries")
    .insert({
      session_id: payload.sessionId,
      type: payload.type,
      episode_no: payload.episodeNo,
      subject_key: payload.subjectKey,
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      importance: payload.importance
    })
    .select("*")
    .single<MemoryRow>();

  if (error) throw new Error(error.message);
  if (payload.type === "short") await trimShortMemories(payload.sessionId);
  return mapMemory(data);
}

export async function updateMemory(memoryId: string, updates: Partial<Omit<MemoryInput, "sessionId">>) {
  const supabase = getSupabaseServerClient();
  const update = normalizeMemoryUpdate(updates);

  if (!supabase) {
    const memory = localStore.memories.find((item) => item.id === memoryId);
    if (!memory) return null;
    Object.assign(memory, update, { updatedAt: nowIso() });
    return memory;
  }

  const dbUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.type) dbUpdate.type = update.type;
  if (typeof update.episodeNo === "number") dbUpdate.episode_no = update.episodeNo;
  if (typeof update.subjectKey === "string") dbUpdate.subject_key = update.subjectKey;
  if (typeof update.title === "string") dbUpdate.title = update.title;
  if (typeof update.content === "string") dbUpdate.content = update.content;
  if (Array.isArray(update.tags)) dbUpdate.tags = update.tags;
  if (typeof update.importance === "number") dbUpdate.importance = update.importance;

  const { data, error } = await supabase
    .from("memory_entries")
    .update(dbUpdate)
    .eq("id", memoryId)
    .select("*")
    .single<MemoryRow>();

  if (error) throw new Error(error.message);
  return mapMemory(data);
}

export async function deleteMemory(memoryId: string) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const target = localStore.memories.find((memory) => memory.id === memoryId);
    if (target?.tags.includes(BASE_CHARACTER_TAG)) throw new Error("기본 등장인물 기억은 삭제할 수 없습니다.");
    const before = localStore.memories.length;
    localStore.memories = localStore.memories.filter((memory) => memory.id !== memoryId);
    return localStore.memories.length < before;
  }

  const { data: target, error: targetError } = await supabase
    .from("memory_entries")
    .select("tags")
    .eq("id", memoryId)
    .maybeSingle<{ tags: string[] | null }>();
  if (targetError) throw new Error(targetError.message);
  if (target?.tags?.includes(BASE_CHARACTER_TAG)) throw new Error("기본 등장인물 기억은 삭제할 수 없습니다.");

  const { error } = await supabase.from("memory_entries").delete().eq("id", memoryId);
  if (error) throw new Error(error.message);
  return true;
}

export function hasOutdatedGeneratedMemories(memories: MemoryEntry[]) {
  return memories.some((memory) => !memory.tags.includes(MEMORY_VERSION_TAG));
}

export async function purgeOutdatedGeneratedMemories(sessionId: string) {
  const memories = await listMemories(sessionId);
  const resetBase = memories.filter((memory) => memory.tags.includes(BASE_CHARACTER_TAG) && !memory.tags.includes(MEMORY_VERSION_TAG));
  const deleteIds = memories
    .filter((memory) => !memory.tags.includes(BASE_CHARACTER_TAG) && !memory.tags.includes(MEMORY_VERSION_TAG))
    .map((memory) => memory.id);

  for (const memory of resetBase) {
    await updateMemory(memory.id, {
      content: BASE_CHARACTER_CONTENT,
      tags: mergeTags(memory.tags, [MEMORY_VERSION_TAG])
    });
  }

  if (!deleteIds.length) return resetBase.length;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    localStore.memories = localStore.memories.filter((memory) => !deleteIds.includes(memory.id));
    return deleteIds.length + resetBase.length;
  }

  const { error } = await supabase.from("memory_entries").delete().in("id", deleteIds);
  if (error) throw new Error(error.message);
  return deleteIds.length + resetBase.length;
}

export async function ensureBaseCharacterMemories(sessionId: string, characters: Character[]) {
  if (!characters.length) return;

  const memories = await listMemories(sessionId);
  const existingKeys = new Set(memories.filter((memory) => memory.type === "character").map((memory) => memory.subjectKey));
  for (const character of characters) {
    const key = normalizeMemorySubject(character.name);
    if (!key || existingKeys.has(key)) continue;
    await createMemory({
      sessionId,
      type: "character",
      subjectKey: character.name,
      title: character.name,
      content: BASE_CHARACTER_CONTENT,
      tags: [BASE_CHARACTER_TAG, MEMORY_VERSION_TAG]
    });
  }
}

export async function recordMemoriesFromTurn({
  sessionId,
  userText,
  assistantText,
  characters,
  currentScene,
  protagonistName,
  messageCount
}: {
  sessionId: string;
  userText: string;
  assistantText: string;
  characters: Character[];
  currentScene: string;
  protagonistName?: string;
  messageCount: number;
}) {
  const turnSummary = summarizeTurn(userText, assistantText);
  if (!turnSummary.short && !turnSummary.long) return;

  const episodeNo = Math.max(1, Math.ceil((messageCount + 2) / 20));
  let memories = await listMemories(sessionId);
  if (hasOutdatedGeneratedMemories(memories)) {
    await purgeOutdatedGeneratedMemories(sessionId);
    memories = await listMemories(sessionId);
  }

  if (turnSummary.short) {
    await appendMemory({
      memories,
      sessionId,
      type: "short",
      episodeNo,
      subjectKey: "rolling-short",
      title: "최근 10편 요약",
      content: turnSummary.short,
      limit: 2200,
      maxLines: 10
    });
  }

  if (turnSummary.long) {
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "long",
      episodeNo,
      subjectKey: `episode-${episodeNo}`,
      title: `에피소드 ${episodeNo}`,
      content: turnSummary.long,
      limit: 3600,
      maxLines: 22
    });
  }

  await ensureBaseCharacterMemories(sessionId, characters);

  const mentionedCharacters = findMentionedCharacters({ userText, assistantText, characters });
  for (const character of mentionedCharacters) {
    const characterSummary = summarizeCharacterMemory(character.name, protagonistName, userText, assistantText);
    if (!characterSummary) continue;
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "character",
      episodeNo,
      subjectKey: character.name,
      title: character.name,
      content: characterSummary,
      limit: 2200,
      maxLines: 12,
      tags: character.base ? [BASE_CHARACTER_TAG, MEMORY_VERSION_TAG] : [GENERATED_CHARACTER_TAG, MEMORY_VERSION_TAG]
    });
  }

  const place = extractMemoryPlace(`${currentScene}\n${assistantText}`);
  if (place) {
    const locationSummary = summarizeLocationMemory(place, userText, assistantText, currentScene);
    if (!locationSummary) return;
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "location",
      episodeNo,
      subjectKey: place,
      title: place,
      content: locationSummary,
      limit: 1800,
      maxLines: 10
    });
  }
}

export async function recordMemoriesFromPlan({
  sessionId,
  plan,
  characters,
  currentScene,
  messageCount
}: {
  sessionId: string;
  plan: EventPlan;
  characters: Character[];
  currentScene: string;
  messageCount: number;
}) {
  const event = stripText(plan.event ?? "");
  const eventKeywords = cleanKeywords(plan.eventKeywords);
  const worldImpact = stripText(plan.worldImpact ?? "");
  const worldImpactKeywords = cleanKeywords(plan.worldImpactKeywords);
  const nextIncident = stripText(plan.nextIncident ?? "");
  const nextIncidentKeywords = cleanKeywords(plan.nextIncidentKeywords);
  if (!event && !eventKeywords.length && !worldImpact && !worldImpactKeywords.length && !nextIncident && !nextIncidentKeywords.length) return false;

  const episodeNo = Math.max(1, Math.ceil((messageCount + 2) / 20));
  let memories = await listMemories(sessionId);
  if (hasOutdatedGeneratedMemories(memories)) {
    await purgeOutdatedGeneratedMemories(sessionId);
    memories = await listMemories(sessionId);
  }

  const eventText = compactJoin([event, eventKeywords.join(", ")], " / ", 180);
  const worldImpactText = compactJoin([worldImpact, worldImpactKeywords.join(", ")], " / ", 180);
  const nextIncidentText = compactJoin([nextIncident, nextIncidentKeywords.join(", ")], " / ", 180);
  const short = compactJoin([eventText, nextIncidentText], " / ", 260);
  const long = compactJoin([worldImpactText ? `세계관 영향: ${worldImpactText}` : "", eventText ? `사건 키워드: ${eventText}` : "", nextIncidentText ? `다음 사건 키워드: ${nextIncidentText}` : ""], " ", 520);

  if (short) {
    await appendMemory({
      memories,
      sessionId,
      type: "short",
      episodeNo,
      subjectKey: "rolling-short",
      title: "최근 10편 요약",
      content: short,
      limit: 2200,
      maxLines: 10
    });
  }

  if (long) {
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "long",
      episodeNo,
      subjectKey: `episode-${episodeNo}`,
      title: `에피소드 ${episodeNo}`,
      content: long,
      limit: 3600,
      maxLines: 22
    });
  }

  await ensureBaseCharacterMemories(sessionId, characters);
  for (const characterMemory of plan.characterMemories ?? []) {
    const name = stripText(characterMemory.name ?? "");
    if (!name || characterMemory.changed !== true || (characterMemory.confidence ?? 0) < 0.55) continue;
    const relationshipKeywords = cleanRelationshipTags(characterMemory.relationshipKeywords);
    const psychologyKeywords = cleanKeywords(characterMemory.psychologyKeywords);
    const content = compactJoin(
      [
        relationshipKeywords.length ? `관계 태그: ${relationshipKeywords.join(", ")}` : "",
        psychologyKeywords.length ? `심리/태도 키워드: ${psychologyKeywords.join(", ")}` : "",
        !relationshipKeywords.length && characterMemory.relationshipToProtagonist ? `관계 태그: ${keywordize(characterMemory.relationshipToProtagonist).join(", ")}` : "",
        !psychologyKeywords.length && characterMemory.psychology ? `심리/태도 키워드: ${keywordize(characterMemory.psychology).join(", ")}` : ""
      ],
      " ",
      300
    );
    if (!content) continue;
    const base = characters.some((character) => normalizeMemorySubject(character.name) === normalizeMemorySubject(name));
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "character",
      episodeNo,
      subjectKey: name,
      title: name,
      content,
      limit: 2200,
      maxLines: 12,
      tags: base ? [BASE_CHARACTER_TAG, MEMORY_VERSION_TAG] : [GENERATED_CHARACTER_TAG, MEMORY_VERSION_TAG]
    });
  }

  const location = plan.locationMemory;
  const locationName = resolvePhysicalLocationName(stripText(location?.name ?? ""), currentScene);
  const locationKeywords = cleanKeywords(location?.memoryKeywords);
  const locationSummary = stripText(location?.summary ?? "");
  const locationContent = locationKeywords.length ? locationKeywords.join(", ") : locationSummary;
  if (locationName && locationContent && location?.changed === true && (location.confidence ?? 0) >= 0.55) {
    await appendMemory({
      memories: await listMemories(sessionId),
      sessionId,
      type: "location",
      episodeNo,
      subjectKey: locationName,
      title: locationName,
      content: `주인공에게 남은 기억 키워드: ${trimToLength(locationContent, 240)}`,
      limit: 1800,
      maxLines: 10
    });
  }

  return true;
}

function cleanKeywords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => stripText(String(item ?? ""))).filter(Boolean))].slice(0, 8);
}

function cleanRelationshipTags(value: unknown) {
  const aliases = new Map([
    ["lover", "연인"],
    ["romance", "연인"],
    ["romantic", "연인"],
    ["friend", "친구"],
    ["friendship", "친구"],
    ["crush", "호감"],
    ["affection", "호감"],
    ["hostility", "적대"],
    ["enemy", "적대"],
    ["distrust", "불신"],
    ["suspicion", "불신"],
    ["worry", "걱정"],
    ["concern", "걱정"],
    ["disappointment", "서운함"],
    ["hurt", "서운함"],
    ["guilt", "죄책감"],
    ["fear", "두려움"],
    ["vigilance", "경계"],
    ["dependence", "의존"],
    ["protectiveness", "보호본능"],
    ["trust", "신뢰"],
    ["curiosity", "호기심"],
    ["sympathy", "동정"],
    ["pity", "연민"]
  ]);
  const allowed = new Set([
    "연인",
    "친구",
    "호감",
    "애정",
    "적대",
    "불신",
    "걱정",
    "서운함",
    "죄책감",
    "두려움",
    "경계",
    "의존",
    "보호본능",
    "신뢰",
    "호기심",
    "동정",
    "연민",
    "질투",
    "분노",
    "불안",
    "안도",
    "거리감",
    "유대",
    "집착",
    "존중"
  ]);
  return cleanKeywords(value)
    .map((tag) => aliases.get(tag.toLowerCase()) ?? tag)
    .filter((tag) => allowed.has(tag))
    .slice(0, 6);
}

function keywordize(value: string) {
  return stripText(value)
    .split(/[,/·ㆍ|，、\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 6);
}

function resolvePhysicalLocationName(candidate: string, currentScene: string) {
  const scene = stripText(currentScene);
  if (!candidate) return scene;
  if (looksLikeOrganizationName(candidate)) return scene;
  return candidate;
}

function looksLikeOrganizationName(value: string) {
  return /(DMA|관리청|관리국|작전국|기관|단체|회사|정부|부서|에이전시|Agency|Office|Department|Bureau)/i.test(value);
}

export async function buildPromptMemorySummary({
  sessionId,
  characters,
  currentScene
}: {
  sessionId: string;
  characters: Character[];
  currentScene: string;
}) {
  const memories = await listMemories(sessionId);
  if (!memories.length) return "";

  const characterKeys = new Set(characters.map((character) => normalizeMemorySubject(character.name)).filter(Boolean));
  const scene = normalizeMemorySubject(currentScene);
  const short = memories
    .filter((memory) => memory.type === "short")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 1);
  const character = memories
    .filter((memory) => memory.type === "character" && memory.content !== BASE_CHARACTER_CONTENT && (!characterKeys.size || characterKeys.has(memory.subjectKey)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const location = memories
    .filter((memory) => memory.type === "location" && memory.subjectKey && (!scene || scene.includes(memory.subjectKey) || memory.content.includes(currentScene.slice(0, 20))))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const latestCharacter = latestBySubject(character).slice(0, 4);

  const blocks = [
    formatMemoryBlock("단기기억 - 최근 3줄", short, { maxLines: 3, maxChars: 360 }),
    formatMemoryBlock("캐릭터기억 - 주인공과의 최신 관계/심리만", latestCharacter, { maxLines: 1, maxChars: 180 }),
    formatMemoryBlock("장소기억 - 현재 장소 관련", location, { maxLines: 1, maxChars: 180 })
  ].filter(Boolean);

  return blocks.join("\n\n");
}

async function appendMemory({
  memories,
  sessionId,
  type,
  episodeNo,
  subjectKey,
  title,
  content,
  limit,
  maxLines,
  tags
}: {
  memories: MemoryEntry[];
  sessionId: string;
  type: MemoryEntryType;
  episodeNo: number;
  subjectKey: string;
  title: string;
  content: string;
  limit: number;
  maxLines: number;
  tags?: string[];
}) {
  const key = normalizeMemorySubject(subjectKey);
  const memoryTags = mergeTags(tags ?? [], [MEMORY_VERSION_TAG]);
  const existing = memories.find((memory) => {
    if (memory.type !== type) return false;
    if (type === "long") return memory.episodeNo === episodeNo;
    return memory.subjectKey === key;
  });

  if (!existing) {
    await createMemory({ sessionId, type, episodeNo, subjectKey, title, content, tags: memoryTags });
    return;
  }

  const nextContent =
    type === "character"
      ? content
      : appendSummaryLine(existing.content === BASE_CHARACTER_CONTENT ? "" : existing.content, content, limit, maxLines);
  await updateMemory(existing.id, { content: nextContent, title, episodeNo, tags: mergeTags(existing.tags, memoryTags) });
}

function summarizeTurn(userText: string, assistantText: string) {
  const userIntent = summarizeUserIntent(userText);
  const event = summarizeEvent(assistantText);
  const short = compactJoin([userIntent, event], " / ", 260);
  const long = compactJoin([userIntent, event], " ", 420);
  return { short, long };
}

function summarizeCharacterMemory(characterName: string, protagonistName: string | undefined, userText: string, assistantText: string) {
  const key = normalizeMemorySubject(characterName);
  const protagonistKeys = [
    protagonistName,
    "주인공",
    "사용자",
    "유저",
    "플레이어",
    "당신"
  ]
    .map((name) => normalizeMemorySubject(name ?? ""))
    .filter(Boolean);
  const sentences = splitMemorySentences(`${userText}\n${assistantText}`);
  const related = sentences.filter((sentence) => normalizeMemorySubject(sentence).includes(key));
  if (!related.length) return "";

  const protagonistRelated = related.filter((sentence) => {
    const normalized = normalizeMemorySubject(sentence);
    return protagonistKeys.some((name) => normalized.includes(name)) || /에게|한테|당신|그쪽|상대|문틈|시선|반응|대답|질문|확인/.test(sentence);
  });
  const attitude = [...protagonistRelated, ...related].find((sentence) => /신뢰|경계|의심|호감|흥미|분노|두려|불안|혼란|긴장|안심|거리|친밀|차갑|건조|무표정|반짝|응시|시선|걱정|보호|확인|요청|설득|거절/.test(sentence));
  const relationship = protagonistRelated.find((sentence) => /에게|한테|대해|향해|바라|묻|말했|확인|요청|설득|경계|신뢰|의심|보호|관심|반응/.test(sentence)) ?? protagonistRelated[0];
  const pieces = [
    relationship ? `주인공 관계: ${trimToLength(stripSpeaker(relationship), 150)}` : "",
    attitude && attitude !== relationship ? `태도/심리 변화: ${trimToLength(stripSpeaker(attitude), 130)}` : ""
  ];
  return compactJoin(pieces, " ", 280);
}

function summarizeLocationMemory(place: string, userText: string, assistantText: string, currentScene: string) {
  const normalizedPlace = normalizeMemorySubject(place);
  const sentences = splitMemorySentences(`${currentScene}\n${userText}\n${assistantText}`);
  const related = sentences.filter((sentence) => {
    const normalized = normalizeMemorySubject(sentence);
    return normalized.includes(normalizedPlace) || normalizedPlace.includes(normalized.slice(0, Math.min(normalized.length, 12)));
  });
  const source = related.length ? related : sentences.slice(0, 3);
  const protagonistMemory =
    source.find((sentence) => /주인공|사용자|유저|당신|에게|한테|느꼈|남았|기억|불안|긴장|두려|안심|깨달|알게|확인|목격|흔적|단서|위험|상처|변화/.test(sentence)) ??
    source[0];
  if (!protagonistMemory) return "";
  return compactJoin([`주인공에게 남은 기억: ${trimToLength(stripSpeaker(protagonistMemory), 180)}`], " ", 220);
}

function appendSummaryLine(current: string, next: string, limit: number, maxLines: number) {
  const nextLine = `- ${next.replace(/\n+/g, " / ")}`;
  const lines = [...current.split("\n").map((line) => line.trim()).filter(Boolean), nextLine];
  const uniqueLines = [...new Set(lines)].slice(-maxLines);
  let result = uniqueLines.join("\n");
  while (result.length > limit && uniqueLines.length > 1) {
    uniqueLines.shift();
    result = uniqueLines.join("\n");
  }
  return result;
}

function findMentionedCharacters({
  userText,
  assistantText,
  characters
}: {
  userText: string;
  assistantText: string;
  characters: Character[];
}) {
  const combined = normalizeMemorySubject(`${userText}\n${assistantText}`);
  const known = characters
    .filter((character) => combined.includes(normalizeMemorySubject(character.name)))
    .map((character) => ({ name: character.name, base: true }));
  const knownKeys = new Set(known.map((character) => normalizeMemorySubject(character.name)));
  const speakers = [...assistantText.matchAll(/^([\p{Script=Hangul}A-Za-z0-9 _-]{1,24})\s*\|/gmu)]
    .map((match) => match[1].trim())
    .filter((name) => name && !knownKeys.has(normalizeMemorySubject(name)))
    .map((name) => ({ name, base: false }));
  const byKey = new Map([...known, ...speakers].map((character) => [normalizeMemorySubject(character.name), character]));
  return [...byKey.values()].slice(0, 8);
}

function stripText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimToLength(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function summarizeUserIntent(value: string) {
  const text = stripText(value);
  if (!text) return "";
  const sentence = splitMemorySentences(text)[0] ?? text;
  return `사용자 의도: ${trimToLength(stripSpeaker(sentence), 100)}`;
}

function summarizeEvent(value: string) {
  const sentences = splitMemorySentences(value);
  if (!sentences.length) return "";
  const important = sentences.filter((sentence) => /결정|확인|요청|제안|거절|발견|드러|변화|공격|도착|이동|대화|질문|응답|감정|시선|경계|긴장|불안|흥미|분노|놀라|문제|위험|비밀|정체|관계/.test(sentence));
  const picked = (important.length ? important : sentences).slice(0, 2).map(stripSpeaker);
  return `진행 요약: ${trimToLength(picked.join(" "), 240)}`;
}

function splitMemorySentences(value: string) {
  return value
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?。？！])\s+|\n{2,}|(?<=다\.)\s*|(?<=요\.)\s*/u)
    .map((sentence) => stripText(sentence.replace(/\*[^*]+\*/g, " ")))
    .filter((sentence) => sentence.length >= 4)
    .slice(0, 24);
}

function stripSpeaker(value: string) {
  return value
    .replace(/^([\p{Script=Hangul}A-Za-z0-9 _-]{1,24})\s*\|\s*/u, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

function compactJoin(parts: Array<string | undefined>, separator: string, limit: number) {
  return trimToLength(parts.map((part) => part?.trim()).filter(Boolean).join(separator), limit);
}

function extractMemoryPlace(value: string) {
  const scene = value.replace(/\s+/g, " ").trim();
  const labelled = scene.match(/(?:장소|위치)\s*[:：]\s*([^#|/\n.。]+)/);
  if (labelled?.[1]) return labelled[1].trim().slice(0, 40);

  const knownPlaces = ["골목", "문 앞", "현관", "방 안", "집 안", "관리청", "DMA", "거리", "사무실", "기록 보관소"];
  const found = knownPlaces.find((place) => scene.includes(place));
  if (found) return found;

  const first = scene.split(/[.。#|]/).map((part) => part.trim()).find(Boolean);
  return first ? first.slice(0, 40) : "";
}

function normalizeMemoryInput(input: MemoryInput) {
  return {
    sessionId: input.sessionId,
    type: input.type,
    episodeNo: Math.max(1, Math.round(input.episodeNo ?? 1)),
    subjectKey: normalizeMemorySubject(input.subjectKey ?? ""),
    title: input.title?.trim() || defaultMemoryTitle(input.type),
    content: input.content.trim(),
    tags: normalizeTags(input.tags),
    importance: clampImportance(input.importance)
  };
}

function normalizeMemoryUpdate(updates: Partial<Omit<MemoryInput, "sessionId">>) {
  return {
    type: updates.type && isMemoryType(updates.type) ? updates.type : undefined,
    episodeNo: typeof updates.episodeNo === "number" ? Math.max(1, Math.round(updates.episodeNo)) : undefined,
    subjectKey: typeof updates.subjectKey === "string" ? normalizeMemorySubject(updates.subjectKey) : undefined,
    title: typeof updates.title === "string" ? updates.title.trim() : undefined,
    content: typeof updates.content === "string" ? updates.content.trim() : undefined,
    tags: Array.isArray(updates.tags) ? normalizeTags(updates.tags) : undefined,
    importance: typeof updates.importance === "number" ? clampImportance(updates.importance) : undefined
  };
}

function normalizeTags(tags?: string[]) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function mergeTags(current: string[], next?: string[]) {
  return normalizeTags([...current, ...(next ?? [])]);
}

function clampImportance(value?: number) {
  return Math.max(1, Math.min(5, Math.round(value ?? 3)));
}

function defaultMemoryTitle(type: MemoryEntryType) {
  return {
    short: "단기기억",
    long: "장기기억",
    character: "캐릭터기억",
    location: "장소기억"
  }[type];
}

async function trimShortMemories(sessionId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const short = localStore.memories
      .filter((memory) => memory.sessionId === sessionId && memory.type === "short")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const removeIds = new Set(short.slice(10).map((memory) => memory.id));
    localStore.memories = localStore.memories.filter((memory) => !removeIds.has(memory.id));
    return;
  }

  const { data } = await supabase
    .from("memory_entries")
    .select("id")
    .eq("session_id", sessionId)
    .eq("type", "short")
    .order("updated_at", { ascending: false })
    .range(10, 200)
    .returns<Array<{ id: string }>>();

  const ids = (data ?? []).map((row) => row.id);
  if (ids.length) await supabase.from("memory_entries").delete().in("id", ids);
}

function latestBySubject(memories: MemoryEntry[]) {
  const bySubject = new Map<string, MemoryEntry>();
  for (const memory of memories) {
    const key = memory.subjectKey || memory.title || memory.id;
    if (!bySubject.has(key)) bySubject.set(key, memory);
  }
  return [...bySubject.values()];
}

function formatMemoryBlock(title: string, memories: MemoryEntry[], options: { maxLines?: number; maxChars?: number } = {}) {
  if (!memories.length) return "";
  return [
    `[${title}]`,
    ...memories.map((memory) => {
      const content = compactMemoryForPrompt(memory.content, options.maxLines ?? 2, options.maxChars ?? 240);
      return `- ${memory.title}${memory.subjectKey ? ` (${memory.subjectKey})` : ""}: ${content}`;
    })
  ].join("\n");
}

function compactMemoryForPrompt(content: string, maxLines: number, maxChars: number) {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(-maxLines);
  return trimToLength(lines.join(" / "), maxChars);
}

function mapMemory(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    episodeNo: row.episode_no ?? 1,
    subjectKey: row.subject_key ?? "",
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
