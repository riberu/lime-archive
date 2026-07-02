import { NextResponse } from "next/server";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { resolveGeminiModelId } from "@/lib/gemini-models";
import { generateGeminiContent, getGeminiApiKeys } from "@/lib/gemini-router";
import { assertEnoughBalance, isInsufficientBalanceError, refundSpend, spendCurrency, type SpendResult } from "@/lib/currency";
import { CHAT_MESSAGE_COST } from "@/lib/currency-config";
import { buildPromptMemorySummary, recordMemoriesFromPlan, recordMemoriesFromTurn } from "@/lib/memories";
import { buildSystemInstruction, extractProtagonistName, toGeminiContents } from "@/lib/prompt";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";
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
  const supabase = getSupabaseServerClient();
  let chatSpend: SpendResult | null = null;
  if (supabase && isUuid(context.userId) && body.persistUser !== false) {
    try {
      await assertEnoughBalance(supabase, context.userId, CHAT_MESSAGE_COST);
      chatSpend = await spendCurrency(supabase, {
        userId: context.userId,
        amount: CHAT_MESSAGE_COST,
        reason: "AI chat message generation",
        referenceType: "chat_session",
        referenceId: body.sessionId,
        idempotencyKey: body.userMessageId ? `chat:${body.sessionId}:${body.userMessageId}` : undefined,
        metadata: {
          storyId: context.story.id,
          model,
          cost: CHAT_MESSAGE_COST,
          replaceMessageId: body.replaceMessageId ?? null
        }
      });
    } catch (error) {
      if (isInsufficientBalanceError(error)) {
        return NextResponse.json(
          {
            error: "not_enough_currency",
            cost: CHAT_MESSAGE_COST,
            message: "Lime Point 또는 Lime Coin이 부족합니다."
          },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: error instanceof Error ? error.message : "Currency spend failed" }, { status: 500 });
    }
  }

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
    await refundChatSpend(supabase, context.userId, chatSpend, "Gemini request failed", response.detail);
    console.error("Gemini request failed", response.status, response.detail);
    return NextResponse.json({ error: `Gemini request failed: ${response.status}` }, { status: 502 });
  }

  const fullText =
    response.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!fullText) {
    await refundChatSpend(supabase, context.userId, chatSpend, "Gemini returned empty text", response.data);
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
    userId: session.userId,
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

async function refundChatSpend(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  spend: SpendResult | null,
  reason: string,
  detail: unknown
) {
  if (!supabase || !spend || !isUuid(userId)) return;

  await refundSpend(supabase, {
    userId,
    spend,
    reason,
    idempotencyKey: `refund:${spend.transactionId}`,
    metadata: {
      detail: typeof detail === "string" ? detail.slice(0, 1000) : detail
    }
  }).catch((error) => console.error("Failed to refund chat spend", error));
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
