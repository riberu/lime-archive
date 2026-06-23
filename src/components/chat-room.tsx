"use client";

import { useMemo, useState } from "react";
import { BookOpen, PanelRightOpen, Send, Settings, X } from "lucide-react";
import type { ChatMessage, ChatSession, Story } from "@/lib/types";

export function ChatRoom({
  initialMessages,
  session,
  story
}: {
  initialMessages: ChatMessage[];
  session: ChatSession;
  story: Story;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [userNote, setUserNote] = useState(session.userNote);
  const [panelOpen, setPanelOpen] = useState(true);
  const [streaming, setStreaming] = useState(false);

  const canSend = input.trim().length > 0 && !streaming;

  const sendMessage = async () => {
    if (!canSend) return;

    const content = input.trim();
    const history = messages;
    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          storyId: story.id,
          content,
          userNote,
          messages: history
        })
      });

      if (!response.ok || !response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: message.content + chunk } : message
          )
        );
      }
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: "응답을 불러오지 못했습니다. Gemini API 키와 서버 로그를 확인해 주세요." }
            : message
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const status = useMemo(() => ["1:1 RP", "GM 진행", "유저 노트 적용", story.statusText || "스트리밍"], [story.statusText]);

  return (
    <div className="grid h-[calc(100dvh-56px)] grid-cols-1 overflow-hidden bg-[#fbfdf7] lg:grid-cols-[260px_1fr_auto]">
      <aside className="hidden border-r border-[#e0ead4] bg-white lg:block">
        <div className="p-4">
          <p className="text-sm font-semibold">채팅 목록</p>
          <div className="mt-4 rounded-lg bg-leaf-50 p-3">
            <p className="line-clamp-1 text-sm font-medium">{story.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-[#66705f]">{session.title}</p>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e0ead4] bg-white px-4">
          <div className="min-w-0">
            <button className="flex min-w-0 items-center gap-2 font-semibold">
              <BookOpen size={18} />
              <span className="truncate">{story.title}</span>
            </button>
            <div className="mt-1 flex gap-2 overflow-hidden">
              {status.map((item) => (
                <span key={item} className="shrink-0 rounded-full bg-leaf-50 px-2 py-0.5 text-xs text-[#526047]">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="grid size-10 place-items-center rounded-md hover:bg-leaf-50"
            aria-label="대화 설정 열기"
          >
            <PanelRightOpen size={20} />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col-reverse gap-8">
            {[...messages].reverse().map((message) => (
              <article key={message.id} className={message.role === "user" ? "border-y border-[#dce8d1] py-4" : ""}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#66705f]">{message.role === "user" ? "User" : "GM"}</span>
                  <button className="text-xs text-[#7a866f]">메시지 옵션</button>
                </div>
                <div className="prose-log whitespace-pre-wrap font-story text-[15px]">{message.content || "..."}</div>
              </article>
            ))}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#e0ead4] bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-[#dce8d1] bg-[#fbfdf7] p-2">
            <textarea
              id="chat-message-input"
              name="chat_message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none"
              placeholder="대사를 입력하거나 행동을 묘사해 주세요."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              disabled={!canSend}
              onClick={() => void sendMessage()}
              className="grid size-10 place-items-center rounded-lg bg-leaf-500 text-white disabled:opacity-40"
              aria-label="메시지 보내기"
            >
              <Send size={18} />
            </button>
          </div>
        </footer>
      </main>

      <UserNotePanel sessionId={session.id} open={panelOpen} note={userNote} onClose={() => setPanelOpen(false)} onChange={setUserNote} />
    </div>
  );
}

function UserNotePanel({
  sessionId,
  open,
  note,
  onClose,
  onChange
}: {
  sessionId: string;
  open: boolean;
  note: string;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  const saveNote = async (value: string) => {
    onChange(value);
    setSaved("saving");
    await fetch(`/api/sessions/${sessionId}/user-note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userNote: value })
    }).catch(() => undefined);
    setSaved("saved");
    window.setTimeout(() => setSaved("idle"), 1200);
  };

  return (
    <aside className={`${open ? "w-full border-l lg:w-[360px]" : "w-0"} overflow-hidden border-[#e0ead4] bg-white transition-all`}>
      <div className="flex h-full min-w-[320px] flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[#e0ead4] px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Settings size={18} /> 대화 설정
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-md hover:bg-leaf-50" aria-label="닫기">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-3 p-4">
          <p className="text-sm leading-6 text-[#66705f]">
            유저의 역할, 외모, 관계, 기억해야 할 특별 지침을 적어두면 Gemini 호출 때 최우선 지시로 주입됩니다.
          </p>
          <textarea
            id="user-note"
            name="user_note"
            defaultValue={note}
            onChange={(event) => void saveNote(event.target.value)}
            className="h-[420px] w-full resize-none rounded-lg border border-[#dce8d1] p-3 text-sm leading-6 outline-none focus:border-leaf-500"
          />
          <p className="text-xs text-[#7a866f]">{saved === "saving" ? "저장 중..." : saved === "saved" ? "저장됨" : "자동 저장"}</p>
        </div>
      </div>
    </aside>
  );
}
