"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Coins, Gem, MessageCircle, Moon, MoreVertical, Pencil, Pin, PinOff, Plus, Sun, Trash2, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ChatListItem = {
  id: string;
  title: string;
  storyTitle?: string;
  imageUrl?: string;
  imageKind?: "story" | "character";
  updatedAt?: string;
  pinned?: boolean;
};

type WalletPayload = {
  wallet?: {
    paidBalance: number;
    freeBalance: number;
    totalBalance: number;
  };
};

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const next = window.localStorage.getItem("lime-theme") === "dark";
    setDark(next);
    document.body.classList.toggle("dark", next);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.body.classList.toggle("dark", next);
    window.localStorage.setItem("lime-theme", next ? "dark" : "light");
  };

  return (
    <button type="button" className="ui-icon-btn" onClick={toggle} aria-label="테마 변경">
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function WalletBadge() {
  const [authToken, setAuthToken] = useState("");
  const [wallet, setWallet] = useState<WalletPayload["wallet"] | null>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const loadWallet = useCallback(async (token = authToken) => {
    if (!token) {
      setWallet(null);
      return;
    }

    const response = await fetch("/api/wallet", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as WalletPayload;
    setWallet(data.wallet ?? null);
  }, [authToken]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token ?? "";
      setAuthToken(token);
      await loadWallet(token);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? "";
      setAuthToken(token);
      if (!token) setWallet(null);
      void loadWallet(token);
    });

    return () => data.subscription.unsubscribe();
  }, [loadWallet]);

  useEffect(() => {
    const refresh = () => void loadWallet();
    window.addEventListener("lime-wallet-refresh", refresh);
    return () => window.removeEventListener("lime-wallet-refresh", refresh);
  }, [loadWallet]);

  useEffect(() => {
    if (!open) return;

    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function claimAttendance() {
    if (!authToken || claiming) return;
    setClaiming(true);
    setMessage("");
    try {
      const response = await fetch("/api/wallet/attendance", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = (await response.json().catch(() => null)) as {
        claimed?: boolean;
        rewardAmount?: number;
        bonusAmount?: number;
        message?: string;
        wallet?: WalletPayload["wallet"];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "출석 보상을 받지 못했어요.");
      if (data?.wallet) setWallet(data.wallet);
      setMessage(data?.claimed ? `오늘 보상 ${formatCurrency((data.rewardAmount ?? 0) + (data.bonusAmount ?? 0))} LP 지급` : "오늘 출석 보상은 이미 받았어요.");
      window.dispatchEvent(new Event("lime-wallet-refresh"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "출석 보상을 받지 못했어요.");
    } finally {
      setClaiming(false);
    }
  }

  if (!authToken) return null;

  return (
    <div ref={rootRef} className="wallet-widget">
      <button type="button" className="wallet-pill" onClick={() => setOpen((current) => !current)} aria-label="재화 잔액">
        <span className="wallet-pill-icon"><Coins size={15} /></span>
        <span>{formatCurrency(wallet?.freeBalance ?? 0)}</span>
        <small>LP</small>
      </button>

      {open ? (
        <section className="wallet-popover" aria-label="재화 지갑">
          <header>
            <div>
              <b>내 지갑</b>
              <span>무료 재화가 먼저 차감돼요</span>
            </div>
            <Link href="/wallet" onClick={() => setOpen(false)}>상세</Link>
          </header>
          <div className="wallet-grid">
            <div>
              <span><Coins size={15} /> Lime Point</span>
              <b>{formatCurrency(wallet?.freeBalance ?? 0)}</b>
            </div>
            <div>
              <span><Gem size={15} /> Lime Coin</span>
              <b>{formatCurrency(wallet?.paidBalance ?? 0)}</b>
            </div>
          </div>
          <button type="button" className="wallet-attendance" onClick={claimAttendance} disabled={claiming}>
            <CalendarCheck size={15} />
            {claiming ? "확인 중..." : "오늘 출석 보상 받기"}
          </button>
          <p>{message || "채팅 1회 생성에는 30 재화가 사용됩니다."}</p>
        </section>
      ) : null}
    </div>
  );
}

export function LimeFloatingChat() {
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [authToken, setAuthToken] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      if (!authToken) {
        setItems([]);
        return;
      }

      const response = await fetch("/api/sessions", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = (response.ok ? await response.json() : null) as { sessions?: ChatListItem[] } | null;
      setItems(data?.sessions ?? []);
    } catch {
      setItems([]);
    }
  }, [authToken]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      setAuthToken(session?.access_token ?? "");
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? "");
      if (!session?.access_token) setItems([]);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!openMenuId) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpenMenuId(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuId]);

  async function updateSession(chat: ChatListItem, payload: { title?: string; pinned?: boolean }) {
    setLoadingId(chat.id);
    try {
      const response = await fetch(`/api/sessions/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("update failed");
      await loadSessions();
    } finally {
      setLoadingId(null);
      setOpenMenuId(null);
    }
  }

  async function renameSession(chat: ChatListItem) {
    const nextTitle = window.prompt("채팅방 이름을 입력해 주세요.", chat.title || chat.storyTitle || "새 채팅");
    if (!nextTitle?.trim()) return;
    await updateSession(chat, { title: nextTitle.trim() });
  }

  async function deleteSession(chat: ChatListItem) {
    const ok = window.confirm("이 채팅방을 진짜 삭제할까요? 삭제하면 복원할 수 없습니다.");
    if (!ok) return;
    setLoadingId(chat.id);
    try {
      const response = await fetch(`/api/sessions/${chat.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error("delete failed");
      setItems((current) => current.filter((item) => item.id !== chat.id));
    } finally {
      setLoadingId(null);
      setOpenMenuId(null);
    }
  }

  return (
    <div ref={rootRef} className="fab">
      <input id="lime-fab-toggle" className="fab-check" type="checkbox" aria-label="라임 채팅 열기" />
      <section className="fab-panel" aria-label="라임 채팅">
        <header className="fab-head">
          <div>
            <b>라임 채팅</b>
            <span>참여중인 채팅방</span>
          </div>
          <label htmlFor="lime-fab-toggle" aria-label="닫기">
            <X size={16} />
          </label>
        </header>

        <div className="fab-list">
          {items.length ? (
            items.map((chat) => (
              <div key={chat.id} className={`fab-row ${chat.pinned ? "is-pinned" : ""}`}>
                <Link href={`/chat/${chat.id}`} className="fab-item" onClick={() => setOpenMenuId(null)}>
                  <span className="fab-avatar">
                    {chat.imageUrl ? <Image src={chat.imageUrl} alt="" fill sizes="38px" className="object-cover" /> : <MessageCircle size={16} />}
                  </span>
                  <span className="fab-meta">
                    <b>
                      {chat.pinned ? <Pin size={12} aria-label="고정됨" /> : null}
                      {chat.title || chat.storyTitle || "새 채팅"}
                    </b>
                    <small>
                      {chat.storyTitle ? `${chat.storyTitle} · ` : ""}
                      {formatDate(chat.updatedAt)}
                    </small>
                  </span>
                </Link>

                <button
                  type="button"
                  className="fab-more"
                  aria-label="채팅방 더보기"
                  aria-expanded={openMenuId === chat.id}
                  disabled={loadingId === chat.id}
                  onClick={() => setOpenMenuId((current) => (current === chat.id ? null : chat.id))}
                >
                  <MoreVertical size={16} />
                </button>

                {openMenuId === chat.id ? (
                  <div className="fab-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => updateSession(chat, { pinned: !chat.pinned })}>
                      {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      {chat.pinned ? "고정 해제" : "고정하기"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => renameSession(chat)}>
                      <Pencil size={14} />
                      이름 변경하기
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={() => deleteSession(chat)}>
                      <Trash2 size={14} />
                      삭제하기
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="fab-empty">
              <p>아직 참여중인 채팅방이 없어요.</p>
              <Link href="/stories">
                <Plus size={15} /> 스토리 탐색
              </Link>
            </div>
          )}
        </div>
      </section>
      <label htmlFor="lime-fab-toggle" className="fab-btn" aria-label="라임 채팅 열기">
        <MessageCircle size={22} />
      </label>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "최근 대화";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 대화";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCurrency(value: number) {
  return Math.trunc(value).toLocaleString("ko-KR");
}
