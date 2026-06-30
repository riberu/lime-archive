import { NextResponse } from "next/server";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { GLOBAL_GM_RULES, SUGGESTION_GM_RULES } from "@/lib/ai-rules";
import { resolveGeminiModelId } from "@/lib/gemini-models";
import { generateGeminiContent, getGeminiApiKeys } from "@/lib/gemini-router";
import { buildPromptMemorySummary } from "@/lib/memories";
import { extractProtagonistName, renderStoryTemplate } from "@/lib/prompt";
import type { ChatMessage } from "@/lib/types";

type Suggestion = {
  text: string;
  kind: "combo";
};

type SuggestionRequest = {
  sessionId: string;
  storyId?: string;
  userNote?: string;
  protagonistName?: string;
  memorySummary?: string;
  modelId?: string;
  messages?: ChatMessage[];
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as SuggestionRequest;
  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const story = await getStory(body.storyId || session.storyId);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const characters = await getCharacters(story.id);
  const storedMessages = await getMessages(session.id);
  const messages = (body.messages?.length ? body.messages : storedMessages).slice(-16);
  const protagonistName = cleanName(body.protagonistName) || extractProtagonistName(body.userNote || session.userNote);
  const currentScene = renderStoryTemplate(session.currentScene || story.currentScene, protagonistName);
  const statusText = renderStoryTemplate(story.statusText, protagonistName);
  const promptMemorySummary = await buildPromptMemorySummary({
    sessionId: session.id,
    characters,
    currentScene: session.currentScene || story.currentScene
  });
  const fallback = buildFallbackSuggestions({
    storyTitle: story.title,
    currentScene,
    characters: characters.map((character) => character.name),
    messages,
    protagonistName
  });

  if (!getGeminiApiKeys().length) return NextResponse.json({ suggestions: fallback });

  const prompt = [
    "[서버 공통 AI 행동규칙]",
    GLOBAL_GM_RULES,
    "",
    "[추천 생성 공통 규칙]",
    SUGGESTION_GM_RULES,
    "",
    "너는 한국어 스토리 롤플레잉 채팅의 다음 선택지를 만드는 보조 AI다.",
    "현재 장면과 최근 대화 흐름을 읽고, 사용자가 바로 누를 수 있는 선택지 3개를 만든다.",
    "각 선택지는 반드시 상황 묘사와 대사 조합이어야 한다.",
    "",
    `[주인공 이름] ${protagonistName}`,
    `[스토리] ${story.title}`,
    `[현재 장면] ${currentScene || "불명"}`,
    `[상태] ${statusText || "불명"}`,
    `[등장인물]\n${characters.map((character) => `${character.name}: ${character.description || character.personality || "설정 없음"}`).join("\n") || "없음"}`,
    `[유저 프로필/유저 노트]\n${body.userNote || session.userNote || "없음"}`,
    `[요약 메모리]\n${[compactSessionMemory(body.memorySummary || session.memorySummary), promptMemorySummary].filter(Boolean).join("\n\n") || "없음"}`,
    "[최근 대화]",
    messages.map((message) => `${message.role}: ${message.content}`).join("\n\n") || "아직 대화 없음",
    "",
    "[선택지 작성 규칙]",
    `- text 안에 "사용자", "유저", "주인공", "플레이어"라는 단어를 쓰지 말고 필요하면 "${protagonistName}"만 쓴다.`,
    "- text는 한 줄 또는 두 줄로 쓴다.",
    "- 상황 묘사는 반드시 `*...*` 안에 넣는다.",
    "- 대사는 별표 밖에 쓴다.",
    "- 한 선택지 안에는 반드시 상황 묘사 1개와 대사 1개가 모두 들어간다.",
    "- NPC가 대답하는 말이나 행동을 선택지로 만들지 않는다.",
    "- 마지막 대답의 선택지를 반복하지 않는다.",
    "- 출력은 JSON 배열만 한다. 마크다운, 설명, 코드블록 금지.",
    `- 형식: [{"kind":"combo","text":"*문틈을 조금 더 열어 신분증을 확인한다* 정말 관리청에서 나오신 거예요?"}]`
  ].join("\n");

  try {
    const model = resolveGeminiModelId(body.modelId);
    const response = await generateGeminiContent({
      model,
      assignmentKey: session.userId && session.userId !== "anonymous" ? session.userId : session.id,
      payload: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.95,
          topP: 0.9,
          maxOutputTokens: 900,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }
    });

    if (!response.ok) {
      console.error("Gemini suggestions request failed", response.status, response.detail);
      return NextResponse.json({ suggestions: fallback });
    }

    const text = response.data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const suggestions = parseSuggestions(text).map((item) => ({
      kind: "combo" as const,
      text: sanitizeForProtagonist(ensureComboText(item.text), protagonistName)
    }));
    return NextResponse.json({ suggestions: suggestions.length ? suggestions : fallback });
  } catch (error) {
    console.error("Gemini suggestions request crashed", error);
    return NextResponse.json({ suggestions: fallback });
  }
}

function compactSessionMemory(value?: string) {
  const lines = (value ?? "")
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(-3);
  return trimToLength(lines.join(" / "), 420);
}

function trimToLength(value: string, limit: number) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trim()}...` : trimmed;
}

function parseSuggestions(text: string): Suggestion[] {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < start) return [];

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Array<Partial<Suggestion>>;
    return parsed
      .map((item): Suggestion => ({
        kind: "combo",
        text: String(item.text ?? "").trim()
      }))
      .filter((item) => item.text.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function ensureComboText(text: string) {
  const trimmed = text.trim();
  if (/\*[^*]+\*/.test(trimmed)) return trimmed;
  return `*상대의 반응을 살피며 잠시 숨을 고른다* ${trimmed}`;
}

function buildFallbackSuggestions({
  storyTitle,
  currentScene,
  characters,
  messages,
  protagonistName
}: {
  storyTitle: string;
  currentScene: string;
  characters: string[];
  messages: ChatMessage[];
  protagonistName: string;
}): Suggestion[] {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const npc = characters[0] ?? "등장인물";
  const sceneHint = sanitizeForProtagonist(currentScene || storyTitle, protagonistName);
  const hasQuestion = /[?？]/.test(lastAssistant);
  const hasDoor = /문|초인종|방문|노크/.test(lastAssistant + sceneHint);

  return [
    {
      kind: "combo",
      text: hasDoor
        ? `*문틈을 열어 ${npc}의 표정을 살핀다* 정말 관리청에서 나오신 거예요?`
        : `*${sceneHint}의 분위기를 살피며 조용히 묻는다* 지금 하신 말, 조금 더 설명해 주세요.`
    },
    {
      kind: "combo",
      text: hasQuestion
        ? "*곧장 대답하지 않고 상대의 의도를 먼저 확인한다* 그 질문에 답하기 전에, 먼저 확인하고 싶은 게 있어요."
        : "*상대의 시선이 향한 곳을 따라가 본다* 아직 숨기고 있는 말이 있죠?"
    },
    {
      kind: "combo",
      text: `*${npc}의 반응을 놓치지 않으려 시선을 고정한다* 여기서 제가 뭘 선택하길 바라는 건가요?`
    }
  ];
}

function sanitizeForProtagonist(text: string, protagonistName: string) {
  return text
    .replaceAll("사용자", protagonistName)
    .replaceAll("유저", protagonistName)
    .replaceAll("플레이어", protagonistName)
    .replaceAll("주인공", protagonistName)
    .replaceAll(`${protagonistName}${protagonistName}`, protagonistName);
}

function cleanName(value?: string) {
  const cleaned = (value ?? "").trim();
  if (!cleaned || cleaned === "기본 페르소나" || cleaned === "주인공" || cleaned === "유저 페르소나") return "";
  return cleaned;
}
