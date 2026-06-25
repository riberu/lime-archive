import { NextResponse } from "next/server";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { resolveGeminiModelId } from "@/lib/gemini-models";
import { buildSystemInstruction, extractProtagonistName, toGeminiContents } from "@/lib/prompt";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

type ChatRequest = {
  sessionId: string;
  storyId: string;
  content: string;
  userNote?: string;
  protagonistName?: string;
  memorySummary?: string;
  outputLength?: number;
  modelId?: string;
  persistUser?: boolean;
  replaceMessageId?: string;
  messages?: ChatMessage[];
};

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
    await persistMessage(body.sessionId, "user", content);
  }

  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is missing. Restart the dev server after adding it to .env.local." },
      { status: 500 }
    );
  }

  const model = resolveGeminiModelId(body.modelId);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: toGeminiContents(context.messages, buildTurnInput(content, protagonistName)),
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: Math.max(1800, Math.min(5200, Math.round((body.outputLength ?? 1100) * 2.8))),
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    }
  );

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error("Gemini request failed", response.status, detail);
    return NextResponse.json({ error: `Gemini request failed: ${response.status}` }, { status: 502 });
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const fullText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!fullText) {
    console.error("Gemini returned empty text", payload);
    return NextResponse.json({ error: "Gemini returned empty text" }, { status: 502 });
  }

  return streamText(sanitizeNarration(fullText, protagonistName), 8, body.sessionId, body.replaceMessageId);
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

function cleanProtagonistName(value?: string) {
  const cleaned = (value ?? "").trim();
  if (!cleaned || cleaned === "기본 페르소나" || cleaned === "주인공" || cleaned === "대표 페르소나") return "";
  return cleaned;
}

function buildTurnInput(content: string, protagonistName: string) {
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
  return lines.join("\n");
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
    userNote: body.userNote || session.userNote || "",
    currentScene: session.currentScene || story.currentScene,
    memorySummary: body.memorySummary ?? session.memorySummary,
    episodeState: session.episodeState,
    messages: body.messages?.length ? body.messages : storedMessages
  };
}

async function persistMessage(sessionId: string, role: "user" | "assistant", content: string) {
  const supabase = getSupabaseServerClient();

  if (!supabase || !isUuid(sessionId)) {
    localStore.messages.push({
      id: slugId("message"),
      sessionId,
      role,
      content,
      createdAt: nowIso()
    });
    return;
  }

  await supabase.from("chat_messages").insert({
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

function streamText(text: string, delayMs: number, sessionId: string, replaceMessageId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const character of text) {
        controller.enqueue(encoder.encode(character));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (replaceMessageId) {
        await updateMessageContent(replaceMessageId, text);
      } else {
        await persistMessage(sessionId, "assistant", text);
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
  return text
    .replaceAll("사용자(주인공)", protagonistName)
    .replaceAll("사용자", protagonistName)
    .replaceAll("유저", protagonistName)
    .replaceAll("플레이어", protagonistName)
    .replaceAll("주인공", protagonistName)
    .replaceAll(`${protagonistName}${protagonistName}`, protagonistName);
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
