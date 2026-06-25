"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  IdCard,
  Image,
  Dice5,
  Info,
  Lightbulb,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Plus,
  Quote,
  RefreshCcw,
  RotateCcw,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Type,
  X
} from "lucide-react";
import type { ChatMessage, ChatSession, Story } from "@/lib/types";
import {
  createBlankPersona,
  formatPersonaForPrompt,
  isPersonaConfigured,
  loadPersonas,
  loadSelectedPersonaId,
  savePersonas,
  saveSelectedPersonaId,
  type UserPersona
} from "@/lib/personas";
import { defaultGeminiModelId, geminiModels, type GeminiModelId } from "@/lib/gemini-models";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const outputLengthSteps = [700, 900, 1100, 1300, 1500, 1800];

type SuggestedReply = {
  text: string;
  kind: "combo";
};

const fallbackSuggestions: SuggestedReply[] = [
  { text: "*문틈 너머의 기척을 조심스럽게 살핀다* 정말 관리청에서 나오신 거예요?", kind: "combo" },
  { text: "*곧장 대답하지 않고 상대의 의도를 먼저 확인한다* 저를 찾아온 이유부터 말해 주세요.", kind: "combo" },
  { text: "*상대가 내민 신분증으로 시선을 내린다* 이게 진짜라는 걸 어떻게 믿죠?", kind: "combo" }
];

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
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("default-persona");
  const [personasLoaded, setPersonasLoaded] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [memorySummary, setMemorySummary] = useState(session.memorySummary);
  const [outputLength, setOutputLength] = useState(1100);
  const [selectedModelId, setSelectedModelId] = useState<GeminiModelId>(defaultGeminiModelId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>(fallbackSuggestions);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [dress, setDress] = useState({ font: "maru", theme: "paper", brightness: 100 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0],
    [personas, selectedPersonaId]
  );
  const personaConfigured = isPersonaConfigured(selectedPersona);
  const selectedModel = geminiModels.find((model) => model.id === selectedModelId) ?? geminiModels[0];
  const canSend = input.trim().length > 0 && !streaming && personaConfigured;
  const effectiveUserNote = useMemo(
    () => [formatPersonaForPrompt(selectedPersona), userNote.trim() ? `[유저 노트]\n${userNote.trim()}` : ""].filter(Boolean).join("\n\n"),
    [selectedPersona, userNote]
  );

  const chatStyle = useMemo(
    () =>
      ({
        "--chat-font":
          dress.font === "myeongjo"
            ? '"NanumMyeongjo", "KoPubBatang", serif'
            : dress.font === "pretendard"
              ? '"Pretendard", sans-serif'
              : '"MaruBuri", "NanumMyeongjo", serif',
        "--chat-bg": dress.theme === "night" ? "#171a1f" : dress.theme === "mint" ? "#f4fbea" : "#ffffff",
        "--chat-ink": dress.theme === "night" ? "#edf2f7" : "#292f36",
        "--chat-dim": String((100 - dress.brightness) / 160)
      }) as CSSProperties,
    [dress]
  );

  const renderPersonaTemplate = (text: string) => {
    const name = selectedPersona?.name?.trim() || "대표 페르소나";
    return text
      .replaceAll("{{protagonistName}}", name)
      .replaceAll("{{playerName}}", name)
      .replaceAll("{{personaName}}", name);
  };

  const status = useMemo(
    () => ["1:1 RP", "GM 진행", "유저 노트 적용", renderPersonaTemplate(story.statusText || "스토리")],
    [story.statusText, selectedPersona?.name]
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.scrollTo({ top: scroll.scrollHeight, behavior });
    });
  };

  useEffect(() => {
    const loadPersonaState = async () => {
      let loadedPersonas = loadPersonas();
      const loadedSelectedId = loadSelectedPersonaId(session.id);

      const supabase = getSupabaseBrowserClient();
      const accessToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token ?? "" : "";
      setAuthToken(accessToken);

      if (accessToken) {
        const response = await fetch("/api/personas", {
          headers: { Authorization: `Bearer ${accessToken}` }
        }).catch(() => null);
        if (response?.ok) {
          const data = (await response.json()) as { personas?: UserPersona[] };
          if (data.personas?.length) {
            loadedPersonas = data.personas;
            savePersonas(loadedPersonas);
          }
        }
      }

      setPersonas(loadedPersonas);
      setSelectedPersonaId(loadedPersonas.some((persona) => persona.id === loadedSelectedId) ? loadedSelectedId : loadedPersonas[0]?.id ?? "default-persona");
      setPersonasLoaded(true);
    };

    void loadPersonaState();

    const savedDress = window.localStorage.getItem("lime-chat-dress");
    if (savedDress) {
      try {
        setDress({ font: "maru", theme: "paper", brightness: 100, ...JSON.parse(savedDress) });
      } catch {
        window.localStorage.removeItem("lime-chat-dress");
      }
    }
    const savedOutputLength = Number(window.localStorage.getItem("lime-output-length"));
    if (outputLengthSteps.includes(savedOutputLength)) setOutputLength(savedOutputLength);
    const savedModelId = window.localStorage.getItem("lime-gemini-model");
    if (geminiModels.some((model) => model.id === savedModelId)) setSelectedModelId(savedModelId as GeminiModelId);
  }, [session.id]);

  useEffect(() => {
    if (!personasLoaded) return;
    if (!personaConfigured) setPanelOpen(true);
  }, [personasLoaded, personaConfigured]);

  useEffect(() => {
    scrollToBottom(messages.length <= initialMessages.length ? "auto" : "smooth");
  }, [messages, initialMessages.length]);

  useEffect(() => {
    if (streaming || suggestOpen || guideOpen || infoOpen) scrollToBottom("smooth");
  }, [streaming, suggestOpen, guideOpen, infoOpen]);

  const sendMessage = async (
    forcedContent?: string,
    options?: {
      persistUser?: boolean;
      replaceMessageId?: string;
      historyOverride?: ChatMessage[];
      appendUserMessage?: boolean;
    }
  ) => {
    const content = (forcedContent ?? input).trim();
    if (!content || streaming) return;
    if (!personaConfigured) {
      setPanelOpen(true);
      return;
    }

    const history = options?.historyOverride ?? messages;
    const shouldAppendUser = options?.appendUserMessage ?? !options?.replaceMessageId;
    if (!forcedContent && !options?.replaceMessageId) setInput("");
    setSuggestOpen(false);
    setMessageMenuId(null);

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

    const targetAssistantId = options?.replaceMessageId ?? assistantMessage.id;
    if (options?.replaceMessageId) {
      setMessages((current) =>
        current.map((message) => (message.id === options.replaceMessageId ? { ...message, content: "" } : message))
      );
    } else {
      setMessages((current) => [...current, ...(shouldAppendUser ? [userMessage] : []), assistantMessage]);
    }
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          storyId: story.id,
          content,
          protagonistName: selectedPersona?.name.trim() || "",
          userNote: effectiveUserNote,
          memorySummary,
          outputLength,
          modelId: selectedModelId,
          persistUser: options?.persistUser,
          replaceMessageId: options?.replaceMessageId,
          messages: history
        })
      });

      if (!response.ok || !response.body) {
        let message = "응답을 불러오지 못했어요.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          message = await response.text().catch(() => message);
        }
        throw new Error(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((current) =>
          current.map((message) =>
            message.id === targetAssistantId ? { ...message, content: message.content + chunk } : message
          )
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gemini API 키 또는 서버 로그를 확인해 주세요.";
      setMessages((current) =>
        current.map((message) =>
          message.id === targetAssistantId
            ? { ...message, content: "응답을 불러오지 못했어요.\n\n" + errorMessage }
            : message
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInput((current) => `${current}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    const selected = textarea ? input.slice(textarea.selectionStart, textarea.selectionEnd) : "";
    insertText(`${before}${selected || "내용"}${after}`);
  };

  const undoLast = () => {
    if (streaming) return;
    setMessages((current) => current.slice(0, Math.max(0, current.length - 2)));
  };

  const regenerate = () => {
    if (streaming) return;
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser) return;
    setMessages((current) => {
      const lastAssistantIndex = [...current].reverse().findIndex((message) => message.role === "assistant");
      if (lastAssistantIndex < 0) return current;
      const index = current.length - 1 - lastAssistantIndex;
      return current.slice(0, index);
    });
    void sendMessage(lastUser.content);
  };

  const truncateAfterMessage = async (message: ChatMessage) => {
    await fetch(`/api/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message.content || "...", truncateAfter: true })
    }).catch(() => undefined);
  };

  const continueFromMessage = async (message: ChatMessage) => {
    if (streaming) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const history = messages.slice(0, index + 1);
    await truncateAfterMessage(message);
    setMessages(history);
    await sendMessage("이전 대화와 요약 메모리, 현재 장면을 기준으로 세계관을 점검하고 다음 사건과 NPC 반응을 자연스럽게 이어 써라.", {
      persistUser: false,
      appendUserMessage: false,
      historyOverride: history
    });
  };

  const regenerateMessage = async (message: ChatMessage) => {
    if (streaming) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const previousUser = [...messages.slice(0, index)].reverse().find((item) => item.role === "user");
    if (!previousUser) return;
    const history = messages.slice(0, index);
    await truncateAfterMessage(message);
    setMessages([...history, { ...message, content: "" }]);
    await sendMessage(
      `직전 사용자 입력을 기준으로 방금 AI 응답을 다시 생성한다. 이전 생성 내용은 무시하고, 세계관 점검 → 행동 반영 → 사건 전개 순서로 새 장면을 작성한다.\n\n직전 사용자 입력: ${previousUser.content}`,
      {
        persistUser: false,
        appendUserMessage: false,
        replaceMessageId: message.id,
        historyOverride: history
      }
    );
  };

  const beginEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.content);
    setMessageMenuId(null);
  };

  const saveEditedMessage = async (message: ChatMessage) => {
    const content = editDraft.trim();
    if (!content) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const response = await fetch(`/api/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, truncateAfter: true })
    });
    if (!response.ok) return;
    setMessages((current) => [...current.slice(0, index), { ...message, content }]);
    setEditingMessageId(null);
    setEditDraft("");
  };

  const triggerTimeSkip = () => {
    void sendMessage("시간을 조금 건너뛰고, 현재 세계관과 이전 대화에 어울리는 다음 장면을 이어 써줘.");
  };

  const triggerIncident = () => {
    void sendMessage("이전 대화와 세계관에 어울리는 예기치 못한 사건을 하나 발생시켜줘.");
  };

  const toggleInfo = () => {
    setInfoOpen((current) => !current);
    setGuideOpen(false);
  };

  const toggleGuide = () => {
    setGuideOpen((current) => !current);
    setInfoOpen(false);
  };

  const loadSuggestions = async () => {
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const response = await fetch("/api/chat/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          storyId: story.id,
          protagonistName: selectedPersona?.name.trim() || "",
          userNote: effectiveUserNote,
          memorySummary,
          modelId: selectedModelId,
          messages: messages.slice(-12)
        })
      });
      const data = (response.ok ? await response.json() : null) as { suggestions?: SuggestedReply[] } | null;
      setSuggestions(data?.suggestions?.length ? data.suggestions : fallbackSuggestions);
    } catch {
      setSuggestions(fallbackSuggestions);
    } finally {
      setSuggestLoading(false);
    }
  };

  useEffect(() => {
    if (!suggestOpen || streaming) return;
    void loadSuggestions();
  }, [suggestOpen, streaming, messages.length, effectiveUserNote, memorySummary, story.id, selectedPersona?.name]);

  const savePersonaList = (next: UserPersona[]) => {
    setPersonas(next);
    savePersonas(next);
    if (!authToken) return;
    void Promise.all(
      next.map((persona) =>
        fetch("/api/personas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(persona)
        }).catch(() => undefined)
      )
    );
  };

  const updateDress = (next: { font: string; theme: string; brightness: number }) => {
    setDress(next);
    window.localStorage.setItem("lime-chat-dress", JSON.stringify(next));
  };

  const selectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    saveSelectedPersonaId(personaId, session.id);
  };

  return (
    <div className="chat-page">
      <main className="chat-main">
        <header className="chat-head">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 font-semibold">
              <BookOpen size={18} />
              <span className="truncate">{story.title}</span>
              <div className="model-picker" title={selectedModel.note}>
                <select
                  aria-label="Gemini 모델 선택"
                  value={selectedModelId}
                  onChange={(event) => {
                    const next = event.target.value as GeminiModelId;
                    setSelectedModelId(next);
                    window.localStorage.setItem("lime-gemini-model", next);
                  }}
                >
                  {geminiModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <span>{selectedModel.grade}</span>
              </div>
            </div>
            <div className="mt-1 flex gap-2 overflow-hidden">
              {status.map((item) => (
                <span key={item} className="chat-badge">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setPanelOpen(true)} className="chat-icon-btn" aria-label="대화 설정 열기">
            <PanelRightOpen size={20} />
          </button>
        </header>

        <section
          ref={scrollRef}
          className="chat-scroll"
          style={chatStyle}
          onClick={() => {
            setPanelOpen(false);
            setMessageMenuId(null);
            scrollToBottom("smooth");
          }}
        >
          <div className="chat-stream">
            {messages.length === 0 ? (
              <article className="story-entry ai">
                <StoryText text={renderPersonaTemplate(story.openingMessage || "첫 장면을 시작해 보세요. 짧게 인사해도 GM이 다음 사건을 이어갑니다.")} />
              </article>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={message.role === "user" ? "story-entry user" : "story-entry ai"}>
                  <StoryText
                    text={message.role === "assistant" ? renderPersonaTemplate(message.content || "...") : message.content || "..."}
                    isUser={message.role === "user"}
                  />
                  {message.role === "assistant" ? (
                    <div className="message-actions" onClick={(event) => event.stopPropagation()}>
                      <div className="message-actions-left">
                        <button
                          type="button"
                          className="continue-pill"
                          onClick={() => void continueFromMessage(message)}
                          disabled={streaming || !message.content.trim()}
                        >
                          이어 보기
                        </button>
                      </div>
                      <div className="message-actions-right">
                        <button
                          type="button"
                          className="message-icon"
                          onClick={() => void regenerateMessage(message)}
                          disabled={streaming || !message.content.trim()}
                          aria-label="응답 다시 생성"
                        >
                          <RefreshCcw size={13} />
                        </button>
                        <div className="message-more">
                          <button
                            type="button"
                            className="message-icon"
                            onClick={() => setMessageMenuId((current) => (current === message.id ? null : message.id))}
                            aria-label="메시지 더보기"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {messageMenuId === message.id ? (
                            <div className="message-menu">
                              <button type="button" onClick={() => beginEditMessage(message)}>
                                수정하기
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {editingMessageId === message.id ? (
                    <div className="message-editor" onClick={(event) => event.stopPropagation()}>
                      <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} />
                      <div className="message-editor-actions">
                        <button type="button" onClick={() => void saveEditedMessage(message)}>
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditDraft("");
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>

          {suggestOpen ? (
            <div className="chat-choice-panel" aria-label="추천 대화">
              {suggestLoading ? <div className="choice-loading">현재 장면에 맞는 선택지를 고르는 중...</div> : null}
              {suggestions.map((reply) => (
                <button key={reply.text} type="button" onClick={() => void sendMessage(formatSuggestedReply(reply))}>
                  <SquarePen size={13} />
                  <span>{reply.text}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <footer className="chat-compose">
          {infoOpen ? (
            <InfoPanel
              story={story}
              session={session}
              userNote={userNote}
              messageCount={messages.length}
              renderPersonaTemplate={renderPersonaTemplate}
            />
          ) : null}

          {guideOpen ? (
            <div className="guide-pop">
              <button type="button" className="gcard" onClick={undoLast} disabled={streaming || messages.length < 2}>
                <b>되돌리기</b>
                <span>마지막 유저 입력과 AI 답변을 화면에서 제거합니다.</span>
              </button>
              <button type="button" className="gcard" onClick={regenerate} disabled={streaming || !messages.some((message) => message.role === "user")}>
                <b>재생성</b>
                <span>마지막 유저 입력으로 AI 답변을 다시 생성합니다.</span>
              </button>
              <button type="button" className="gcard" onClick={triggerTimeSkip} disabled={streaming}>
                <b>시간</b>
                <span>시간을 조금 넘겨 다음 장면으로 이어갑니다.</span>
              </button>
              <button type="button" className="gcard" onClick={triggerIncident} disabled={streaming}>
                <b>사건</b>
                <span>세계관에 맞는 새 사건을 발생시킵니다.</span>
              </button>
            </div>
          ) : null}

          <div className="chat-tools">
            <button type="button" className="ctool" onClick={toggleInfo}>
              <Info size={15} /> 정보
            </button>
            <button type="button" className="ctool" onClick={() => wrapSelection("*", "*")}>
              <Sparkles size={15} /> 상황
            </button>
            <button type="button" className="ctool" onClick={() => wrapSelection('"', '"')}>
              <Quote size={15} /> 대사
            </button>
            <button type="button" className="ctool" onClick={toggleGuide}>
              <Lightbulb size={15} /> 가이드
            </button>
            <button
              type="button"
              className="ctool"
              onClick={() => {
                setSuggestOpen((current) => !current);
              }}
            >
              <Sparkles size={15} /> 추천
            </button>
          </div>

          <div className="composer">
            <textarea
              ref={textareaRef}
              id="chat-message-input"
              name="chat_message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => scrollToBottom("smooth")}
              placeholder="대사, 행동, 묘사를 입력하세요."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button type="button" disabled={!canSend} onClick={() => void sendMessage()} className="send-btn" aria-label="메시지 보내기">
              <Send size={18} />
            </button>
          </div>
        </footer>
      </main>

      <UserNotePanel
        sessionId={session.id}
        open={panelOpen}
        note={userNote}
        dress={dress}
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        requirePersonaSetup={personasLoaded && !personaConfigured}
        memorySummary={memorySummary}
        outputLength={outputLength}
        onDressChange={updateDress}
        onClose={() => setPanelOpen(false)}
        onChange={setUserNote}
        onPersonasChange={savePersonaList}
        onPersonaSelect={selectPersona}
        onMemorySummaryChange={setMemorySummary}
        onOutputLengthChange={setOutputLength}
      />
    </div>
  );
}

function StoryText({ text, isUser = false }: { text: string; isUser?: boolean }) {
  if (isUser) return <UserText text={text} />;

  const lines = text.split("\n").filter((line, index, all) => line.trim() || index < all.length - 1);

  return (
    <div className="story-text">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const isHeader = trimmed.startsWith("[ #");
        const isDialogue = /.+\|\s*["“]/.test(trimmed) || /^["“].+["”]$/.test(trimmed);
        const className = isHeader ? "story-line status" : isDialogue ? "story-line dialogue" : "story-line narration";

        return (
          <p key={`${index}-${trimmed.slice(0, 12)}`} className={className}>
            {line || "\u00a0"}
          </p>
        );
      })}
    </div>
  );
}

function UserText({ text }: { text: string }) {
  const lines = text.split("\n").filter((line, index, all) => line.trim() || index < all.length - 1);

  return (
    <div className="story-text user-text">
      {lines.map((line, lineIndex) => (
        <p key={`${lineIndex}-${line.slice(0, 12)}`} className="story-line user-line">
          {splitUserLine(line).map((part, partIndex) => (
            <span key={`${partIndex}-${part.text.slice(0, 8)}`} className={part.kind === "situation" ? "user-situation" : "user-dialogue"}>
              {part.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function splitUserLine(line: string) {
  const parts: Array<{ kind: "dialogue" | "situation"; text: string }> = [];
  const pattern = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "dialogue", text: line.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "situation", text: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    parts.push({ kind: "dialogue", text: line.slice(lastIndex) });
  }

  if (parts.length) return parts;
  return [{ kind: looksLikeSituation(line) ? "situation" : "dialogue", text: line || "\u00a0" }];
}

function formatSuggestedReply(reply: SuggestedReply) {
  return reply.text;
}

function looksLikeSituation(line: string) {
  const text = line.trim();
  if (!text) return false;
  if (/["“”]/.test(text)) return false;
  if (/[?？!！]$/.test(text)) return false;
  return /(한다|한다\.|된다|된다\.|린다|린다\.|는다|는다\.|다닌다|다가간다|기다린다|묻는다|살핀다|바라본다|문을|시선|고개|손|걸음|주변|반응|의도|분위기)/.test(text);
}

function InfoPanel({
  story,
  session,
  userNote,
  messageCount,
  renderPersonaTemplate
}: {
  story: Story;
  session: ChatSession;
  userNote: string;
  messageCount: number;
  renderPersonaTemplate: (text: string) => string;
}) {
  const currentScene = renderPersonaTemplate(session.currentScene || story.currentScene || "불명");
  const statusText = renderPersonaTemplate(story.statusText || "불명");

  return (
    <div className="info-pop">
      <div className="info-grid">
        <InfoItem label="현재 장면" value={currentScene} />
        <InfoItem label="상태" value={statusText} />
        <InfoItem label="대화량" value={`${messageCount}개 메시지`} />
        <InfoItem label="유저 노트" value={userNote.trim() || "아직 작성하지 않았어요."} />
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

function UserNotePanel({
  sessionId,
  open,
  note,
  dress,
  personas,
  selectedPersonaId,
  requirePersonaSetup,
  memorySummary,
  outputLength,
  onDressChange,
  onClose,
  onChange,
  onPersonasChange,
  onPersonaSelect,
  onMemorySummaryChange,
  onOutputLengthChange
}: {
  sessionId: string;
  open: boolean;
  note: string;
  dress: { font: string; theme: string; brightness: number };
  personas: UserPersona[];
  selectedPersonaId: string;
  requirePersonaSetup: boolean;
  memorySummary: string;
  outputLength: number;
  onDressChange: (value: { font: string; theme: string; brightness: number }) => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onPersonasChange: (value: UserPersona[]) => void;
  onPersonaSelect: (value: string) => void;
  onMemorySummaryChange: (value: string) => void;
  onOutputLengthChange: (value: number) => void;
}) {
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [dialog, setDialog] = useState<"guide" | "persona" | "note" | "output" | "memory" | "font" | null>(null);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];

  useEffect(() => {
    if (open && requirePersonaSetup) setDialog("persona");
  }, [open, requirePersonaSetup]);

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

  const saveMemorySummary = async (value: string) => {
    onMemorySummaryChange(value);
    setSaved("saving");
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memorySummary: value })
    }).catch(() => undefined);
    setSaved("saved");
    window.setTimeout(() => setSaved("idle"), 1200);
  };

  const changeOutputLength = (value: number) => {
    onOutputLengthChange(value);
    window.localStorage.setItem("lime-output-length", String(value));
  };

  const savePersona = () => {
    if (!editingPersona) return;
    if (!isPersonaConfigured(editingPersona)) return;
    const next = personas.some((persona) => persona.id === editingPersona.id)
      ? personas.map((persona) => (persona.id === editingPersona.id ? editingPersona : persona))
      : [...personas, editingPersona];
    onPersonasChange(next);
    onPersonaSelect(editingPersona.id);
    setEditingPersona(null);
  };

  return (
    <aside className={`note-panel ${open ? "note-open" : ""}`}>
      <div className="note-inner">
        <header className="note-head">
          <div className="flex items-center gap-2 font-semibold">
            <Settings size={18} /> 대화 설정
          </div>
          <button type="button" onClick={onClose} className="chat-icon-btn" aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="note-body">
          <div className="setting-section-label">채팅방 설정</div>
          <SettingRow icon={<Compass size={17} />} label="플레이 가이드" onClick={() => setDialog("guide")} />
          <SettingRow icon={<IdCard size={17} />} label="대화 프로필" detail={selectedPersona?.name ?? "기본 페르소나"} onClick={() => setDialog("persona")} />
          <SettingRow icon={<FileText size={17} />} label="유저 노트" detail={note.trim() ? "작성됨" : "비어 있음"} onClick={() => setDialog("note")} />
          <SettingRow icon={<SlidersHorizontal size={17} />} label="최대 출력량 조절" detail={`${outputLength.toLocaleString("ko-KR")}자`} onClick={() => setDialog("output")} />
          <SettingRow icon={<FileText size={17} />} label="요약 메모리" detail={memorySummary.trim() ? "작성됨" : "비어 있음"} onClick={() => setDialog("memory")} />

          <div className="setting-section-label">전체 설정</div>
          <SettingRow icon={<Type size={17} />} label="글꼴" detail={dress.font === "maru" ? "마루부리" : dress.font === "myeongjo" ? "명조" : "프리텐다드"} onClick={() => setDialog("font")} />
          <div className="setting-row">
            <span className="setting-row-icon"><Image size={17} /></span>
            <span className="setting-row-main">상황 이미지 보기</span>
            <span className="setting-switch" aria-hidden="true" />
          </div>
        </div>
      </div>

      {dialog ? (
        <div className="setting-modal-backdrop" onClick={() => setDialog(null)}>
          <div className="setting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="setting-modal-head">
              <b>{dialogTitle(dialog)}</b>
              <button type="button" onClick={() => setDialog(null)} className="chat-icon-btn" aria-label="닫기">
                <X size={17} />
              </button>
            </header>

            {dialog === "note" ? (
              <div className="setting-modal-body">
                <p>이 채팅방에서 AI가 매 요청마다 참고해야 하는 개인 지침입니다.</p>
                <textarea
                  id="user-note"
                  name="user_note"
                  defaultValue={note}
                  onChange={(event) => void saveNote(event.target.value)}
                  className="note-textarea compact"
                />
                <span className="save-state">{saved === "saving" ? "저장 중..." : saved === "saved" ? "저장됨" : "자동 저장"}</span>
              </div>
            ) : null}

            {dialog === "persona" ? (
              <div className="setting-modal-body">
                <div className="persona-actions">
                  <p>현재 채팅에 적용할 사용자 페르소나를 선택합니다.</p>
                  <button type="button" className="mini-add text" onClick={() => setEditingPersona(createBlankPersona())}>
                    <Plus size={14} /> 새로 추가
                  </button>
                </div>
                <div className="persona-list">
                  {personas.map((persona) => (
                    <div key={persona.id} className={`persona-select ${persona.id === selectedPersonaId ? "active" : ""}`}>
                      <button type="button" onClick={() => onPersonaSelect(persona.id)}>
                        <b>{persona.name || "이름 없는 페르소나"}</b>
                        <span>{persona.appearance || persona.memo || "설정 내용 없음"}</span>
                      </button>
                      <button type="button" className="ui-icon-btn" onClick={() => setEditingPersona(persona)} aria-label="수정">
                        {persona.id === selectedPersonaId ? <Check size={15} /> : <Pencil size={15} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {dialog === "font" ? (
              <div className="setting-modal-body">
                <div className="setting-grid">
                  {[
                    ["maru", "마루부리"],
                    ["myeongjo", "명조"],
                    ["pretendard", "프리텐다드"]
                  ].map(([value, label]) => (
                    <button key={value} type="button" className={`setting-chip ${dress.font === value ? "active" : ""}`} onClick={() => onDressChange({ ...dress, font: value })}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="setting-grid">
                  {[
                    ["paper", "종이"],
                    ["mint", "연두"],
                    ["night", "야간"]
                  ].map(([value, label]) => (
                    <button key={value} type="button" className={`setting-chip ${dress.theme === value ? "active" : ""}`} onClick={() => onDressChange({ ...dress, theme: value })}>
                      {label}
                    </button>
                  ))}
                </div>
                <label className="range-row" htmlFor="chat-brightness">
                  밝기
                  <input id="chat-brightness" name="chat_brightness" type="range" min="60" max="120" value={dress.brightness} onChange={(event) => onDressChange({ ...dress, brightness: Number(event.target.value) })} />
                </label>
              </div>
            ) : null}

            {dialog === "output" ? (
              <div className="setting-modal-body">
                <p>AI가 한 번에 이어 쓰는 목표 분량입니다. 현재 값은 {outputLength.toLocaleString("ko-KR")}자입니다.</p>
                <label className="range-row" htmlFor="output-length">
                  출력 글자수
                  <input
                    id="output-length"
                    name="output_length"
                    type="range"
                    min="0"
                    max={outputLengthSteps.length - 1}
                    step="1"
                    value={Math.max(0, outputLengthSteps.indexOf(outputLength))}
                    onChange={(event) => changeOutputLength(outputLengthSteps[Number(event.target.value)] ?? 1100)}
                  />
                </label>
                <div className="output-number">{outputLength.toLocaleString("ko-KR")}자</div>
              </div>
            ) : null}

            {dialog === "memory" ? (
              <div className="setting-modal-body">
                <p>지금까지의 장기 흐름, 확정된 관계, 중요한 떡밥을 요약해 두면 다음 응답에 함께 반영됩니다.</p>
                <textarea
                  id="memory-summary"
                  name="memory_summary"
                  defaultValue={memorySummary}
                  onChange={(event) => void saveMemorySummary(event.target.value)}
                  className="note-textarea compact"
                />
                <span className="save-state">{saved === "saving" ? "저장 중..." : saved === "saved" ? "저장됨" : "자동 저장"}</span>
              </div>
            ) : null}

            {dialog === "guide" ? (
              <div className="setting-modal-body">
                <p>상황은 별표로 감싸고, 대사는 그대로 적으면 됩니다. 대사 없이 행동만 입력하면 AI가 주변 인물 반응과 사건 전개로 장면을 이어 씁니다.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {editingPersona ? (
        <div className="setting-modal-backdrop" onClick={() => setEditingPersona(null)}>
          <div className="setting-modal" onClick={(event) => event.stopPropagation()}>
            <header className="setting-modal-head">
              <b>페르소나 편집</b>
              <button type="button" onClick={() => setEditingPersona(null)} className="chat-icon-btn" aria-label="닫기">
                <X size={17} />
              </button>
            </header>
            <div className="setting-modal-body">
              <PersonaInput label="이름" value={editingPersona.name} onChange={(value) => setEditingPersona((current) => (current ? { ...current, name: value } : current))} />
              <PersonaInput label="외모" value={editingPersona.appearance} onChange={(value) => setEditingPersona((current) => (current ? { ...current, appearance: value } : current))} textarea />
              <PersonaInput label="말투" value={editingPersona.speechStyle} onChange={(value) => setEditingPersona((current) => (current ? { ...current, speechStyle: value } : current))} />
              <PersonaInput label="추가 메모" value={editingPersona.memo} onChange={(value) => setEditingPersona((current) => (current ? { ...current, memo: value } : current))} textarea />
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingPersona(null)}>취소</button>
                <button type="button" className="btn btn-primary" disabled={!isPersonaConfigured(editingPersona)} onClick={savePersona}>저장</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function SettingRow({
  icon,
  label,
  detail,
  onClick
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="setting-row" onClick={onClick}>
      <span className="setting-row-icon">{icon}</span>
      <span className="setting-row-main">{label}</span>
      {detail ? <span className="setting-row-detail">{detail}</span> : null}
      <ChevronRight size={15} />
    </button>
  );
}

function PersonaInput({
  label,
  value,
  textarea = false,
  onChange
}: {
  label: string;
  value: string;
  textarea?: boolean;
  onChange: (value: string) => void;
}) {
  const id = `chat-persona-${label}`;
  return (
    <label className="persona-input" htmlFor={id}>
      <span>{label}</span>
      {textarea ? (
        <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function dialogTitle(dialog: "guide" | "persona" | "note" | "output" | "memory" | "font") {
  return {
    guide: "플레이 가이드",
    persona: "대화 프로필",
    note: "유저 노트",
    output: "최대 출력량 조절",
    memory: "요약 메모리",
    font: "글꼴"
  }[dialog];
}
