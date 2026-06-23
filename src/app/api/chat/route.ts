import { NextResponse } from "next/server";
import { getCharacters, getMessages, getSession, getStory } from "@/lib/data";
import { localStore, nowIso, slugId } from "@/lib/local-store";
import { buildSystemInstruction, toGeminiContents } from "@/lib/prompt";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

type ChatRequest = {
  sessionId: string;
  storyId: string;
  content: string;
  userNote?: string;
  messages?: ChatMessage[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const context = await loadChatContext(body);
  const systemInstruction = buildSystemInstruction({
    story: context.story,
    characters: context.characters,
    userNote: context.userNote,
    currentScene: context.currentScene,
    memorySummary: context.memorySummary,
    episodeState: context.episodeState
  });

  await persistMessage(body.sessionId, "user", content);

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return streamText(
      "묵유는 잠시 당신의 말을 곱씹더니, 손끝으로 낡은 단말의 화면을 밀어 올렸다.\n\n" +
        "\"좋습니다. 지금부터는 당신의 설정을 우선으로 두고 진행하죠. 그런데 방금, 기록 보관소의 잠금이 혼자 열렸습니다. 누군가 이 대화를 듣고 있었던 것 같습니다.\"\n\n" +
        "복도 끝의 형광등이 한 번 깜박이고, 닫혀 있던 문 너머에서 낮은 발소리가 가까워진다.",
      18,
      body.sessionId
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: toGeminiContents(context.messages, content),
        generationConfig: {
          temperature: 0.95,
          topP: 0.95,
          maxOutputTokens: 1800
        }
      })
    }
  );

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";
      let fullText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const textMatches = buffer.matchAll(/"text":\s*"((?:\\.|[^"\\])*)"/g);
          let emitted = "";

          for (const match of textMatches) {
            emitted += JSON.parse(`"${match[1]}"`) as string;
          }

          if (emitted) {
            fullText += emitted;
            controller.enqueue(encoder.encode(emitted));
            buffer = "";
          }
        }
      } finally {
        if (fullText.trim()) await persistMessage(body.sessionId, "assistant", fullText);
        controller.close();
      }
    }
  });

  return textStreamResponse(stream);
}

async function loadChatContext(body: ChatRequest) {
  const session = await getSession(body.sessionId);
  const story = await getStory(body.storyId || session.storyId);
  const characters = await getCharacters(story.id);
  const storedMessages = await getMessages(session.id);

  return {
    story,
    characters,
    userNote: session.userNote || body.userNote || "",
    currentScene: session.currentScene || story.currentScene,
    memorySummary: session.memorySummary,
    episodeState: session.episodeState,
    messages: storedMessages.length ? storedMessages : body.messages ?? []
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

function streamText(text: string, delayMs: number, sessionId: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const character of text) {
        controller.enqueue(encoder.encode(character));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      await persistMessage(sessionId, "assistant", text);
      controller.close();
    }
  });

  return textStreamResponse(stream);
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
