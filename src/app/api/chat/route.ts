import { NextResponse } from "next/server";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { resolveGeminiModelId } from "@/lib/gemini-models";
import { generateGeminiContent, getGeminiApiKeys } from "@/lib/gemini-router";
import { buildPromptMemorySummary, recordMemoriesFromPlan, recordMemoriesFromTurn } from "@/lib/memories";
import { buildSystemInstruction, extractProtagonistName, toGeminiContents } from "@/lib/prompt";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Character, ChatMessage } from "@/lib/types";
import type { EventPlan } from "@/lib/memories";

export const runtime = "nodejs";

type ChatRequest = {
  sessionId: string;
  storyId: string;
  content: string;
  userMessageId?: string;
  assistantMessageId?: string;
  userNote?: string;
  protagonistName?: string;
  memorySummary?: string;
  outputLength?: number;
  modelId?: string;
  persistUser?: boolean;
  replaceMessageId?: string;
  messages?: ChatMessage[];
};

const eventPlanMarker = "[[EVENT_PLAN]]";
const suggestionsMarker = "[[SUGGESTIONS]]";

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  let context: Awaited<ReturnType<typeof loadChatContext>>;
  try {
    context = await loadChatContext(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat context not found" }, { status: 404 });
  }
  const protagonistName = cleanProtagonistName(body.protagonistName) || extractProtagonistName(context.userNote);
  const systemInstruction = buildSystemInstruction({
    story: context.story,
    characters: context.characters,
    userNote: context.userNote,
    currentScene: context.currentScene,
    memorySummary: context.memorySummary,
    outputLength: body.outputLength,
    episodeState: context.episodeState,
    protagonistName
  });

  if (body.persistUser !== false) {
    await persistMessage(body.sessionId, "user", content, body.userMessageId);
  }

  if (!getGeminiApiKeys().length) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is missing. Restart the dev server after adding it to .env.local." },
      { status: 500 }
    );
  }

  const model = resolveGeminiModelId(body.modelId);
  const response = await generateGeminiContent({
    model,
    assignmentKey: context.assignmentKey,
    payload: {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: toGeminiContents(context.messages, buildTurnInput(content, protagonistName)),
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: Math.max(2600, Math.min(7600, Math.round((body.outputLength ?? 1500) * 3.4))),
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    }
  });

  if (!response.ok) {
    console.error("Gemini request failed", response.status, response.detail);
    return NextResponse.json({ error: `Gemini request failed: ${response.status}` }, { status: 502 });
  }

  const fullText =
    response.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!fullText) {
    console.error("Gemini returned empty text", response.data);
    return NextResponse.json({ error: "Gemini returned empty text" }, { status: 502 });
  }

  const parsedResponse = parseGeneratedResponse(fullText, context.currentScene);
  const sanitizedText = sanitizeNarration(parsedResponse.storyText, protagonistName);
  const textWithHiddenBlocks = appendHiddenBlocks(sanitizedText, content, parsedResponse.eventPlan, parsedResponse.suggestions);
  const memoryPromise = body.replaceMessageId
    ? Promise.resolve()
    : parsedResponse.eventPlan
      ? recordMemoriesFromPlan({
        sessionId: body.sessionId,
        plan: parsedResponse.eventPlan,
        characters: context.characters,
        currentScene: context.currentScene,
        messageCount: context.messages.length
      }).then(() => undefined).catch((error) => console.error("Failed to record planned memories", error))
      : recordMemoriesFromTurn({
        sessionId: body.sessionId,
        userText: content,
        assistantText: sanitizedText,
        characters: context.characters,
        currentScene: context.currentScene,
        protagonistName,
        messageCount: context.messages.length
      }).catch((error) => console.error("Failed to record memories", error));

  return streamText(textWithHiddenBlocks, 8, body.sessionId, {
    replaceMessageId: body.replaceMessageId,
    assistantMessageId: body.assistantMessageId,
    memoryPromise
  });
}

function cleanProtagonistName(value?: string) {
  const cleaned = (value ?? "").trim();
  if (!cleaned || cleaned === "기본 페르소나" || cleaned === "주인공" || cleaned === "대표 페르소나") return "";
  return cleaned;
}

async function createEventPlan({
  model,
  assignmentKey,
  context,
  content,
  protagonistName
}: {
  model: string;
  assignmentKey: string;
  context: Awaited<ReturnType<typeof loadChatContext>>;
  content: string;
  protagonistName: string;
}): Promise<EventPlan | null> {
  const response = await generateGeminiContent({
    model,
    assignmentKey: `${assignmentKey}:plan`,
    payload: {
      systemInstruction: {
        parts: [{ text: buildEventPlanInstruction() }]
      },
      contents: [
        {
          role: "user",
          parts: [{
            text: [
              `[작품] ${context.story.title}`,
              `[주인공] ${protagonistName}`,
              `[현재 장면] ${context.currentScene}`,
              `[등장인물]\n${context.characters.map(formatCharacterForPlan).join("\n") || "없음"}`,
              `[요약 메모리] ${context.memorySummary || "없음"}`,
              `[최근 대화]`,
              context.messages.slice(-8).map((message) => `${message.role}: ${trimToLength(message.content, 500)}`).join("\n\n"),
              `[새 사용자 입력]`,
              content
            ].join("\n\n")
          }]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        topP: 0.8,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    }
  });

  if (!response.ok) {
    console.warn("Event plan request failed", response.status, response.detail);
    return null;
  }

  const text = response.data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  return normalizeEventPlan(parseJsonObject(text), context.currentScene);
}

function buildEventPlanInstruction() {
  return [
    "너는 인터랙티브 웹소설의 사건 설계자다.",
    "사용자 입력이 세계관에 끼치는 영향과 다음 장면에서 실제 발생할 사건을 짧은 JSON으로만 작성한다.",
    "완성 본문을 쓰지 않는다. 설명문, 마크다운, 코드블록 없이 JSON 객체만 출력한다.",
    "",
    "판단 순서:",
    "1. 유저노트/주인공 대화 프로필을 최우선으로 읽고, 주인공이 실제로 말하거나 행동한 것만 기준으로 삼는다.",
    "2. 이번 턴에 등장할 캐릭터를 고를 때 캐릭터 성격/말투/스토리 내 역할/캐릭터 프롬프트와 요약 메모리의 최신 관계를 사건보다 먼저 반영한다.",
    "3. 그 다음 이번 채팅 입력이 세계관, 장소, 세력, 위험도, 주변 상황에 끼친 영향을 판단한다.",
    "4. 위 판단이 끝난 뒤에만 다음 사건과 activeCharacters를 정한다.",
    "",
    "규칙:",
    "- 캐릭터 기억은 주인공과의 관계/태도/심리 변화가 있을 때만 changed=true.",
    "- 캐릭터 기억에는 타 인물과의 관계를 저장하지 않는다. 주인공과의 관계, 심리/태도 변화만 기록한다.",
    "- 이름이 언급되었다는 이유만으로 characterMemories에 넣지 않는다.",
    "- 장소 기억은 사건이 실제로 벌어진 물리적 배경 장소만 저장한다.",
    "- 기관명, 단체명, 회사명, 관리청, 부서명, 세계관 고유명사는 언급되어도 장소 기억의 name이 될 수 없다.",
    "- 예: 도심 한복판에서 DMA가 언급되었다면 locationMemory.name은 DMA가 아니라 도심 한복판이다.",
    "- 장소 기억은 그 장소에서 주인공에게 남은 일, 감정, 위협, 단서, 흔적이 있을 때만 changed=true.",
    "- locationMemory.summary는 장소 설명이 아니라 '이 장소에서 주인공에게 무엇이 남았는가'를 짧게 쓴다.",
    "- activeCharacters는 이번 턴에 실제로 대사/행동할 인물만 1~3명으로 제한한다.",
    "- forbiddenSpeakers에는 이번 턴에 말하면 안 되는 배경 인물을 넣는다.",
    "",
    "스키마:",
    `{"event":"짧은 사건","worldImpact":"세계관 영향","nextIncident":"이번 응답에서 발생시킬 다음 사건","activeCharacters":["이름"],"silentCharacters":["이름"],"forbiddenSpeakers":["이름"],"characterMemories":[{"name":"이름","relationshipToProtagonist":"주인공과의 관계 변화","psychology":"심리/태도 변화","changed":true,"confidence":0.8}],"locationMemory":{"name":"장소","summary":"이 장소에서 주인공에게 남은 기억/감정/단서","changed":true,"confidence":0.8}}`
  ].join("\n");
}

function formatCharacterForPlan(character: Character) {
  return [
    `- ${character.name}`,
    character.gender ? `  성별: ${character.gender}` : "",
    character.age ? `  나이: ${character.age}` : "",
    character.roleNote ? `  스토리 내 역할/메모: ${trimToLength(character.roleNote, 220)}` : "",
    character.description ? `  소개: ${trimToLength(character.description, 180)}` : "",
    character.personality ? `  성격: ${trimToLength(character.personality, 220)}` : "",
    character.speechStyle ? `  말투: ${trimToLength(character.speechStyle, 180)}` : "",
    character.prompt ? `  캐릭터 프롬프트: ${trimToLength(character.prompt, 360)}` : ""
  ].filter(Boolean).join("\n");
}

function parseJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeEventPlan(value: Record<string, unknown> | null, currentScene: string): EventPlan | null {
  if (!value) return null;
  const plan: EventPlan = {
    event: cleanPlanText(value.event),
    eventKeywords: cleanPlanList(value.eventKeywords).slice(0, 8),
    worldImpact: cleanPlanText(value.worldImpact),
    worldImpactKeywords: cleanPlanList(value.worldImpactKeywords).slice(0, 8),
    nextIncident: cleanPlanText(value.nextIncident),
    nextIncidentKeywords: cleanPlanList(value.nextIncidentKeywords).slice(0, 8),
    activeCharacters: cleanPlanList(value.activeCharacters).slice(0, 3),
    silentCharacters: cleanPlanList(value.silentCharacters).slice(0, 8),
    forbiddenSpeakers: cleanPlanList(value.forbiddenSpeakers).slice(0, 8),
    characterMemories: Array.isArray(value.characterMemories)
      ? value.characterMemories.slice(0, 6).map((item) => normalizeCharacterPlan(item)).filter(Boolean) as EventPlan["characterMemories"]
      : [],
    locationMemory: normalizeLocationPlan(value.locationMemory, currentScene)
  };
  if (!plan.event && !plan.eventKeywords?.length && !plan.worldImpact && !plan.worldImpactKeywords?.length && !plan.nextIncident && !plan.nextIncidentKeywords?.length) return null;
  return plan;
}

function normalizeCharacterPlan(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = cleanPlanText(item.name);
  if (!name) return null;
  return {
    name,
    relationshipToProtagonist: cleanPlanText(item.relationshipToProtagonist),
    relationshipKeywords: cleanPlanList(item.relationshipKeywords).slice(0, 8),
    psychology: cleanPlanText(item.psychology),
    psychologyKeywords: cleanPlanList(item.psychologyKeywords).slice(0, 8),
    changed: item.changed === true,
    confidence: clampConfidence(item.confidence)
  };
}

function normalizeLocationPlan(value: unknown, currentScene: string) {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const name = resolvePhysicalLocationName(cleanPlanText(item.name), currentScene);
  const summary = cleanPlanText(item.summary);
  const memoryKeywords = cleanPlanList(item.memoryKeywords).slice(0, 8);
  if (!name || (!summary && !memoryKeywords.length)) return undefined;
  return {
    name,
    summary,
    memoryKeywords,
    changed: item.changed === true,
    confidence: clampConfidence(item.confidence)
  };
}

function cleanPlanText(value: unknown) {
  return typeof value === "string" ? trimToLength(value.replace(/\s+/g, " ").trim(), 420) : "";
}

function cleanPlanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanPlanText(item)).filter(Boolean))];
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function resolvePhysicalLocationName(candidate: string, currentScene: string) {
  const scene = cleanPlanText(currentScene);
  if (!candidate) return scene;
  if (looksLikeOrganizationName(candidate)) return scene;
  return candidate;
}

function looksLikeOrganizationName(value: string) {
  return /(DMA|관리청|관리국|작전국|기관|단체|회사|정부|부서|에이전시|Agency|Office|Department|Bureau)/i.test(value);
}

function trimToLength(value: string, limit: number) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trim()}...` : trimmed;
}

function buildTurnInput(content: string, protagonistName: string, eventPlan?: EventPlan | null) {
  const interpretation = analyzeUserTurn(content);
  const lines = [
    "[이번 사용자 입력]",
    content,
    "",
    "[서버 입력 해석]",
    `- 주인공 이름/호칭: ${protagonistName}`,
    `- 입력 유형: ${interpretation.hasDialogue ? "대사 포함" : "행동/상황 묘사"}`
  ];

  if (interpretation.hasDialogue) {
    lines.push(`- 주인공이 직접 말한 대사 후보: ${interpretation.dialogueText}`);
    lines.push(`- 이 대사만 ${protagonistName}의 말로 자연스럽게 다듬어 반영한다.`);
  } else {
    lines.push(`- 이번 입력에는 ${protagonistName}의 직접 대사가 없다.`);
    lines.push(`- 절대 "${protagonistName} | ..." 형식의 주인공 대사를 새로 만들지 않는다.`);
    lines.push(`- ${protagonistName}의 행동이 장면과 NPC에게 미치는 결과만 서술한다.`);
  }

  lines.push("- 입력 원문을 반복하지 말고, 행동 반영과 NPC 반응 및 사건 전개로 이어 간다.");
  lines.push("- 본문 마지막에는 사용자에게 보이지 않는 추천 선택지 블록을 반드시 붙인다.");
  lines.push("- 추천 선택지 블록 형식은 정확히 `[[SUGGESTIONS]]` 다음 줄부터 `1. ...`, `2. ...`, `3. ...` 세 줄이다.");
  lines.push("- 추천 선택지는 사용자가 다음에 누를 수 있는 행동+대사 조합으로 쓰고, 각 줄은 90자 이내로 쓴다.");
  lines.push("");
  lines.push("[Hidden EVENT_PLAN block - required]");
  lines.push(`- After the visible story body, append ${eventPlanMarker} and one JSON object, then append ${suggestionsMarker}.`);
  lines.push("- EVENT_PLAN is for memory only. Do not write sentence summaries in it.");
  lines.push("- Use keyword/name units only: short nouns, emotions, relationship labels, place names, threat names.");
  lines.push("- Keep each keyword 1-4 words. Prefer arrays over prose.");
  lines.push("- eventKeywords: what happened this turn, as keywords.");
  lines.push("- worldImpactKeywords: how the world/story state changed, as keywords.");
  lines.push("- nextIncidentKeywords: likely next beat, as keywords.");
  lines.push("- characterMemories: only active/named characters whose relationship or psychology toward the protagonist changed.");
  lines.push("- characterMemories.relationshipKeywords must be relationship/emotion tags toward the protagonist only.");
  lines.push("- Good relationshipKeywords examples: lover, friend, crush, hostility, distrust, worry, disappointment, guilt, affection, fear, vigilance, dependence, protectiveness.");
  lines.push("- Bad relationshipKeywords examples: explanation request, looked at door, showed ID, asked question, moved away.");
  lines.push("- characterMemories.psychologyKeywords: changed emotion, attitude, trust, fear, suspicion, curiosity keywords.");
  lines.push("- locationMemory.name must be the physical place where the event happened, not an organization merely mentioned.");
  lines.push("- locationMemory.memoryKeywords: what would remain in the protagonist's memory about that place.");
  lines.push("- activeCharacters: characters who actually speak or act this turn, usually 1-3 names.");
  lines.push("- silentCharacters/forbiddenSpeakers: names that should not speak in this turn.");
  lines.push("- Mark changed=false when nothing meaningful changed.");
  lines.push('- Schema: {"eventKeywords":["keyword"],"worldImpactKeywords":["keyword"],"nextIncidentKeywords":["keyword"],"activeCharacters":["name"],"silentCharacters":["name"],"forbiddenSpeakers":["name"],"characterMemories":[{"name":"name","relationshipKeywords":["relationship tag"],"psychologyKeywords":["emotion tag"],"changed":true,"confidence":0.8}],"locationMemory":{"name":"physical place","memoryKeywords":["keyword"],"changed":true,"confidence":0.8}}');
  if (eventPlan) {
    lines.push("");
    lines.push("[이번 턴 사건 계획 - 내부 참고용, 출력 금지]");
    lines.push(JSON.stringify(eventPlan, null, 2));
    lines.push("");
    lines.push("[이번 턴 인물 운용 규칙]");
    lines.push(`- activeCharacters만 대사하거나 직접 행동할 수 있다: ${(eventPlan.activeCharacters ?? []).join(", ") || "계획에 지정된 인물 없음"}`);
    lines.push(`- silentCharacters는 관찰/침묵/반응 묘사만 가능하고 대사하지 않는다: ${(eventPlan.silentCharacters ?? []).join(", ") || "없음"}`);
    lines.push(`- forbiddenSpeakers는 이번 턴에 직접 등장하거나 말하지 않는다: ${(eventPlan.forbiddenSpeakers ?? []).join(", ") || "없음"}`);
    lines.push("- 모든 등장인물에게 발언 기회를 주려 하지 않는다.");
    lines.push("- 새로 대사하는 인물은 최대 2명으로 제한한다.");
    if (eventPlan.nextIncident) lines.push(`- 반드시 반영할 사건 방향: ${eventPlan.nextIncident}`);
  }
  return lines.join("\n");
}

function parseGeneratedResponse(text: string, currentScene: string) {
  const eventIndex = text.lastIndexOf(eventPlanMarker);
  const suggestionsIndex = text.lastIndexOf(suggestionsMarker);
  const hiddenIndexes = [eventIndex, suggestionsIndex].filter((index) => index >= 0);
  const firstHiddenIndex = hiddenIndexes.length ? Math.min(...hiddenIndexes) : -1;
  const storyText = firstHiddenIndex >= 0 ? text.slice(0, firstHiddenIndex).trim() : text.trim();
  const eventEndIndex = suggestionsIndex > eventIndex ? suggestionsIndex : undefined;
  const eventText = eventIndex >= 0 ? text.slice(eventIndex + eventPlanMarker.length, eventEndIndex).trim() : "";
  const suggestionsText = suggestionsIndex >= 0 ? text.slice(suggestionsIndex + suggestionsMarker.length).trim() : "";

  return {
    storyText,
    eventPlan: normalizeEventPlan(parseJsonObject(eventText), currentScene),
    suggestions: parseInlineSuggestions(`${suggestionsMarker}\n${suggestionsText}`)
  };
}

function appendHiddenBlocks(text: string, userContent: string, eventPlan?: EventPlan | null, suggestions: string[] = []) {
  const normalizedSuggestions = suggestions.length >= 3 ? suggestions.slice(0, 3) : buildFallbackSuggestions(userContent, eventPlan);
  const eventBlock = eventPlan ? `\n\n${eventPlanMarker}\n${JSON.stringify(eventPlan)}` : "";
  return `${text.trim()}${eventBlock}\n\n${suggestionsMarker}\n${normalizedSuggestions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function buildFallbackSuggestions(userContent: string, eventPlan?: EventPlan | null) {
  const directionKeyword = eventPlan?.nextIncidentKeywords?.[0] || eventPlan?.nextIncident || "";
  const direction = directionKeyword ? `*${directionKeyword}에 반응한다*` : "*상대의 반응을 살피며 한 걸음 물러선다*";
  return [
    `${direction} 지금 무슨 일이 벌어지는 건지 설명해 주세요.`,
    "*주변의 기척을 확인하며 낮게 묻는다* 아직 숨기는 게 더 있나요?",
    `*방금 들은 말을 되짚으며 시선을 고정한다* ${trimToLength(userContent, 42)}`
  ];
}

function appendInlineSuggestions(text: string, userContent: string, eventPlan?: EventPlan | null) {
  if (parseInlineSuggestions(text).length >= 3) return text;
  const direction = eventPlan?.nextIncident ? `*${eventPlan.nextIncident}에 반응한다*` : "*상대의 반응을 살피며 한 걸음 물러선다*";
  const fallback = [
    `${direction} 지금 무슨 일이 벌어진 건지 설명해 주세요.`,
    "*주변의 기척을 확인하며 낮게 묻는다* 아직 숨기는 게 더 있나요?",
    `*방금 한 말을 되짚으며 시선을 고정한다* ${trimToLength(userContent, 42)}`
  ];
  return `${text.trim()}\n\n[[SUGGESTIONS]]\n${fallback.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function parseInlineSuggestions(text: string) {
  const marker = "[[SUGGESTIONS]]";
  const index = text.lastIndexOf(marker);
  if (index < 0) return [];
  return text
    .slice(index + marker.length)
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function analyzeUserTurn(content: string) {
  const withoutActions = content.replace(/\*[^*]+\*/g, " ").trim();
  const quoted = [...content.matchAll(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/g)].map((match) => match[1].trim());
  const candidates = [withoutActions, ...quoted].map((value) => value.trim()).filter(Boolean);
  const dialogueCandidates = candidates.filter((candidate) => !looksLikeNarrationInput(candidate));
  return {
    hasDialogue: dialogueCandidates.length > 0,
    dialogueText: dialogueCandidates.join(" / ")
  };
}

function looksLikeNarrationInput(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (/[?？！]$/.test(text)) return false;
  if (/[요죠까니해]?[.!…]?$/.test(text) && /^(아니|네|예|응|글쎄|잠깐|누구|뭐|왜|좋아|싫어|괜찮|알겠|모르겠)/.test(text)) return false;
  if (/(한다|했다|된다|되었다|본다|바라본다|열어본다|연다|닫는다|걷는다|멈춘다|기다린다|돌아본다|다가간다|물러선다|앉는다|선다|고개를 든다|고개를 숙인다)[.!…]*$/.test(text)) return true;
  if (/(시선|고개|문|발걸음|침묵|손|표정|몸|숨|눈빛|행동|상황)/.test(text) && /[.!…]*$/.test(text)) return true;
  return false;
}

async function loadChatContext(body: ChatRequest) {
  const session = await getSession(body.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const story = await getStory(body.storyId || session.storyId);
  if (!story) {
    throw new Error("Story not found");
  }

  const characters = await getCharacters(story.id);
  const storedMessages = await getMessages(session.id);

  return {
    story,
    characters,
    assignmentKey: session.userId && session.userId !== "anonymous" ? session.userId : session.id,
    userNote: body.userNote || session.userNote || "",
    currentScene: session.currentScene || story.currentScene,
    memorySummary: [compactSessionMemory(body.memorySummary ?? session.memorySummary), await buildPromptMemorySummary({
      sessionId: session.id,
      characters,
      currentScene: session.currentScene || story.currentScene
    })].filter(Boolean).join("\n\n"),
    episodeState: session.episodeState,
    messages: body.messages?.length ? body.messages : storedMessages
  };
}

function compactSessionMemory(value?: string) {
  const lines = (value ?? "")
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(-3);
  return trimToLength(lines.join(" / "), 420);
}

async function persistMessage(sessionId: string, role: "user" | "assistant", content: string, messageId?: string) {
  const supabase = getSupabaseServerClient();
  const id = messageId && isUuid(messageId) ? messageId : "";

  if (!supabase || !isUuid(sessionId)) {
    localStore.messages.push({
      id: id || slugId("message"),
      sessionId,
      role,
      content,
      createdAt: nowIso()
    });
    return;
  }

  await supabase.from("chat_messages").insert({
    ...(id ? { id } : {}),
    session_id: sessionId,
    role,
    content
  });
}

async function updateMessageContent(messageId: string, content: string) {
  const supabase = getSupabaseServerClient();

  if (!supabase || !isUuid(messageId)) {
    const message = localStore.messages.find((item) => item.id === messageId);
    if (message) {
      message.content = content;
      return true;
    }
    return false;
  }

  const { error } = await supabase.from("chat_messages").update({ content }).eq("id", messageId);
  return !error;
}

function streamText(
  text: string,
  delayMs: number,
  sessionId: string,
  options: {
    replaceMessageId?: string;
    assistantMessageId?: string;
    memoryPromise: Promise<void>;
  }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const character of text) {
        controller.enqueue(encoder.encode(character));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (options.replaceMessageId) {
        await updateMessageContent(options.replaceMessageId, text);
      } else {
        await persistMessage(sessionId, "assistant", text, options.assistantMessageId);
        await options.memoryPromise;
      }
      controller.close();
    }
  });

  return textStreamResponse(stream);
}

function buildLocalFallback(content: string, context: Awaited<ReturnType<typeof loadChatContext>>) {
  const parsed = parseUserInput(content);
  const turn = context.messages.length + 1;
  const scene = sanitizeNarration(context.currentScene || context.story.currentScene || "현재 장면이 아직 정해지지 않았다.", extractProtagonistName(context.userNote));
  const speaker = extractProtagonistName(context.userNote);
  const npcName = context.characters[0]?.name || "등장인물";
  const secondNpcName = context.characters.find((character) => character.name !== npcName)?.name;
  const place = extractHeaderPlace(scene);
  const subject = `${speaker}${hasFinalConsonant(speaker) ? "은" : "는"}`;
  const actionLine = parsed.actions.length
    ? `${subject} ${joinKorean(parsed.actions)}.`
    : `${speaker}의 말이 조용히 공기 속으로 번졌다.`;
  const dialogueLines = parsed.dialogues.length
    ? parsed.dialogues.map((dialogue) => `${speaker} | "${trimSentence(dialogue)}"`).join("\n\n")
    : "";
  const sceneSetup = buildSceneSetup(scene, speaker, npcName);
  const inputEffect = buildInputEffect(parsed, speaker, npcName);
  const npcResponse = buildNpcResponse(parsed, speaker, npcName, secondNpcName);
  const eventBeat = buildEventBeat(scene, npcName, secondNpcName);

  return [
    `[ #${turn} | 🌙 | 📅 현재 | 📍 ${place} | ⏰ 지금 ]`,
    "",
    sceneSetup,
    "",
    actionLine,
    "",
    dialogueLines,
    "",
    inputEffect,
    "",
    npcResponse,
    "",
    eventBeat
  ]
    .filter((line, index, lines) => line || lines[index - 1] !== "")
    .join("\n");
}

function parseUserInput(content: string) {
  const actions: string[] = [];
  const dialogues: string[] = [];
  const actionPattern = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = actionPattern.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index).trim();
    addParsedChunk(before, actions, dialogues);
    actions.push(normalizeAction(match[1]));
    lastIndex = match.index + match[0].length;
  }

  const rest = content.slice(lastIndex).trim();
  addParsedChunk(rest, actions, dialogues);

  if (!actions.length && looksLikeAction(content)) {
    actions.push(normalizeAction(content));
    return { actions, dialogues: [] };
  }

  return { actions, dialogues };
}

function looksLikeAction(content: string) {
  return /(한다|했다|된다|됐다|묻는다|되묻는다|기다린다|살핀다|바라본다|간다|갔다|본다|봤다|연다|열었다|닫는다|닫았다|걷는다|다가간다|앉는다|일어난다|고개|손|문|시선|주변|반응|의도|분위기)/.test(content);
}

function addParsedChunk(chunk: string, actions: string[], dialogues: string[]) {
  if (!chunk) return;
  if (looksLikeAction(chunk) && !/[?？!！"“”]/.test(chunk)) {
    actions.push(normalizeAction(chunk));
    return;
  }
  dialogues.push(chunk);
}

function normalizeAction(action: string) {
  const cleaned = action.trim().replace(/[.。]+$/g, "");
  if (/문.*(연다|열|나간다|나가)/.test(cleaned)) {
    return "문을 열고 나가려다 잠시 멈춰 섰다";
  }
  if (/고개.*(든다|들|돌린다|돌)/.test(cleaned)) {
    return "고개를 들어 앞에 선 인물을 바라보았다";
  }
  if (/다가간다|다가섰/.test(cleaned)) {
    return "한 걸음 가까이 다가섰다";
  }
  return cleaned;
}

function extractHeaderPlace(scene: string) {
  const clean = scene.replace(/\s+/g, " ").trim();
  const placePatterns = [
    /(?:에서|장소[:：]\s*)([^.。,\n]+(?:실|방|앞|안|밖|저|홀|궁|성|거리|정원|복도|문가|저택|공작저))/,
    /(접견실|응접실|현관문 앞|자택 앞|복도|정원|공작저|왕궁|저택|거리|방 안|문 앞)/
  ];

  for (const pattern of placePatterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1].replace(/^(현재|지금)\s*/, "").trim();
    if (match?.[0]) return match[0].trim();
  }

  return clean.split(/[.。,\n]/)[0]?.slice(0, 28) || "현재 장소";
}

function buildSceneSetup(scene: string, protagonistName: string, npcName: string) {
  if (/계약|약혼|공작|접견/.test(scene)) {
    return `접견실의 공기는 말끔하게 정돈되어 있었지만, 탁자 위에 놓인 계약서는 아직 마지막 서명을 기다리고 있었다. ${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 감정을 접어 둔 얼굴로 ${protagonistName}을 바라보았고, 은제 펜촉 끝에는 짧은 침묵이 맺혀 있었다.`;
  }
  if (/문|현관|방문/.test(scene)) {
    return `문 너머의 기척이 가까워질수록 장면의 숨이 얕아졌다. 닫힌 문과 열린 틈 사이에서 ${npcName}의 시선이 조용히 움직였고, ${protagonistName}의 다음 반응을 기다리는 공기가 미세하게 굳었다.`;
  }
  return `${scene} ${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 그 흐름이 끊기지 않도록 숨을 고르며 ${protagonistName}의 반응을 살폈다.`;
}

function buildInputEffect(parsed: ReturnType<typeof parseUserInput>, protagonistName: string, npcName: string) {
  if (parsed.actions.length && parsed.dialogues.length) {
    return `${protagonistName}의 말과 움직임이 동시에 떨어지자, ${npcName}의 표정에 아주 작은 균열이 생겼다. 대답을 기다리던 정적은 더 이상 같은 모양으로 머물지 못했고, 방금의 행동이 장면의 방향을 한 칸 앞으로 밀어냈다.`;
  }
  if (parsed.actions.length) {
    return `${protagonistName}의 행동은 말보다 먼저 장면에 닿았다. ${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 그 움직임의 의미를 읽으려는 듯 시선을 낮췄다가, 곧장 다시 들어 올렸다.`;
  }
  return `${protagonistName}의 말이 끝나자, ${npcName}의 눈빛이 잠깐 흔들렸다. 방금의 문장은 단순한 대답이라기보다, 이 관계의 다음 조건을 다시 묻는 신호처럼 공기 중에 남았다.`;
}

function buildNpcResponse(
  parsed: ReturnType<typeof parseUserInput>,
  protagonistName: string,
  npcName: string,
  secondNpcName?: string
) {
  const hasQuestion = parsed.dialogues.some((dialogue) => /[?？]/.test(dialogue));
  const hasContractScene = parsed.actions.concat(parsed.dialogues).join(" ").match(/계약|약혼|서명|조건|설명|뜻|의도/);

  if (hasContractScene) {
    return [
      `${npcName} | "좋습니다. 그럼 돌려 말하지 않겠습니다. 이 계약은 ${protagonistName}을 묶어 두기 위한 장식이 아니라, 제 쪽에서도 물러설 수 없는 방패입니다."`,
      "",
      `${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 계약서의 첫 장을 천천히 넘겼다. 종이가 스치는 소리가 접견실 안에서 유난히 선명하게 들렸다.`,
      "",
      `${npcName} | "다만 서명하기 전에 하나는 확인해야 합니다. ${protagonistName}, 이 약혼을 이용할 생각입니까, 아니면 버틸 생각입니까?"`
    ].join("\n");
  }

  if (hasQuestion) {
    return [
      `${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 바로 대답하지 않았다. 질문의 표면보다 그 안쪽에 숨은 경계심을 먼저 읽는 듯했다.`,
      "",
      `${npcName} | "그 질문에 답하면, 당신도 제게 하나는 답해야 합니다. 지금 가장 두려운 게 뭡니까?"`
    ].join("\n");
  }

  if (secondNpcName) {
    return [
      `${npcName}의 침묵이 길어지려는 순간, ${secondNpcName}${hasFinalConsonant(secondNpcName) ? "이" : "가"} 먼저 숨을 들이켰다.`,
      "",
      `${secondNpcName} | "잠깐. 지금 그 반응, 그냥 넘기면 안 될 것 같은데요."`,
      "",
      `${npcName} | "나도 알아. 그래서 더 서두르지 않는 겁니다."`
    ].join("\n");
  }

  return [
    `${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 손끝으로 탁자의 모서리를 한 번 눌렀다. 침착한 동작이었지만, 그 짧은 힘에는 숨긴 초조함이 배어 있었다.`,
    "",
    `${npcName} | "방금의 반응은 대답으로 받아들이기 어렵군요. 하지만 아무 말도 하지 않은 것보다는 훨씬 많은 걸 말했습니다."`
  ].join("\n");
}

function buildEventBeat(scene: string, npcName: string, secondNpcName?: string) {
  if (/계약|약혼|공작|접견/.test(scene)) {
    return `그때 접견실 바깥에서 짧은 노크가 울렸다. 문이 열리기도 전에 봉인된 서류 봉투 하나가 문틈 아래로 밀려 들어왔다. 봉투 위에는 ${npcName}의 문장이 찍혀 있었지만, 봉랍은 이미 반쯤 금이 가 있었다.`;
  }
  if (/문|현관|방문/.test(scene)) {
    return `문밖 복도에서 다른 발소리가 하나 더 겹쳐졌다. ${secondNpcName ?? npcName}${hasFinalConsonant(secondNpcName ?? npcName) ? "은" : "는"} 그 소리를 듣자마자 표정을 굳혔고, 아직 끝나지 않은 대화 위로 새로운 긴장이 내려앉았다.`;
  }
  return `정적이 다시 내려앉기 전, 가까운 곳에서 금속이 맞부딪히는 소리가 났다. ${npcName}${hasFinalConsonant(npcName) ? "은" : "는"} 고개를 돌렸고, 방금까지 미뤄 두었던 선택이 더 이상 미뤄질 수 없다는 듯 공기가 바뀌었다.`;
}

function trimSentence(dialogue: string) {
  return dialogue.replace(/^["“]|["”]$/g, "").trim();
}

function joinKorean(actions: string[]) {
  if (actions.length === 1) return actions[0];
  return actions.slice(0, -1).join(", ") + " 그리고 " + actions[actions.length - 1];
}

function hasFinalConsonant(value: string) {
  const last = value.trim().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function sanitizeNarration(text: string, protagonistName: string) {
  const protagonistText = text
    .replaceAll("사용자(주인공)", protagonistName)
    .replaceAll("사용자", protagonistName)
    .replaceAll("유저", protagonistName)
    .replaceAll("플레이어", protagonistName)
    .replaceAll("주인공", protagonistName)
    .replaceAll(`${protagonistName}${protagonistName}`, protagonistName);
  return collapseRepeatedText(protagonistText);
}

function collapseRepeatedText(text: string) {
  return text
    .split("\n")
    .map((line) => collapseRepeatedLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function collapseRepeatedLine(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 40) return line;
  const half = Math.floor(trimmed.length / 2);
  if (trimmed.length % 2 === 0 && trimmed.slice(0, half) === trimmed.slice(half)) {
    return line.replace(trimmed, trimmed.slice(0, half));
  }

  const sentences = trimmed.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length >= 4 && sentences.length % 2 === 0) {
    const middle = sentences.length / 2;
    const first = sentences.slice(0, middle).join("");
    const second = sentences.slice(middle).join("");
    if (first === second) return line.replace(trimmed, sentences.slice(0, middle).join(" "));
  }
  return line;
}

function textStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
