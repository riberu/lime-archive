"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Bot, ChevronDown, Edit3, Globe2, MessageCircle, Plus, Share2, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LibraryWork = {
  id: string;
  type: "world" | "story" | "character";
  title: string;
  description: string;
  imageUrl: string;
  visibility: "public" | "private";
  storyId?: string | null;
  chatCount: number;
  updatedAt: string;
};

type LibrarySession = {
  id: string;
  title: string;
  updatedAt: string;
  pinned: boolean;
};

type ParticipationGroup = {
  item: LibraryWork;
  sessions: LibrarySession[];
};

type LibraryResponse = {
  ownWorlds: LibraryWork[];
  ownStories: LibraryWork[];
  ownCharacters: LibraryWork[];
  participatedStories: ParticipationGroup[];
  participatedCharacters: ParticipationGroup[];
  error?: string;
};

type MainTab = "own" | "participating";
type OwnTab = "worlds" | "stories" | "characters";
type ParticipatingTab = "stories" | "characters";

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80";
const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=80";

export function MyWorksPageClient() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryResponse>({
    ownWorlds: [],
    ownStories: [],
    ownCharacters: [],
    participatedStories: [],
    participatedCharacters: []
  });
  const [token, setToken] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("own");
  const [ownTab, setOwnTab] = useState<OwnTab>("stories");
  const [participatingTab, setParticipatingTab] = useState<ParticipatingTab>("stories");
  const [openGroupKey, setOpenGroupKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.replace("/signup");
        return;
      }

      setToken(session.access_token);
      await loadLibrary(session.access_token);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        router.replace("/signup");
        return;
      }
      setToken(session.access_token);
      void loadLibrary(session.access_token);
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  const loadLibrary = async (accessToken: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/my/library", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (response.status === 401) {
        router.replace("/signup");
        return;
      }

      const data = (await response.json()) as LibraryResponse;
      if (!response.ok) {
        setError(data.error ?? "보관함을 불러오지 못했어요.");
        return;
      }

      setLibrary(data);
    } catch {
      setError("보관함을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const ownItems = ownTab === "worlds" ? library.ownWorlds : ownTab === "stories" ? library.ownStories : library.ownCharacters;
  const participatingGroups = participatingTab === "stories" ? library.participatedStories : library.participatedCharacters;
  const counts = useMemo(
    () => ({
      own: library.ownWorlds.length + library.ownStories.length + library.ownCharacters.length,
      participating: library.participatedStories.length + library.participatedCharacters.length,
      chats: [...library.participatedStories, ...library.participatedCharacters].reduce((sum, group) => sum + group.sessions.length, 0)
    }),
    [library]
  );

  const deleteWork = (item: LibraryWork) => {
    if (!token) return;
    if (!window.confirm(`'${item.title}'을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    startTransition(async () => {
      const response = await fetch(`/api/${item.type === "world" ? "worlds" : item.type === "story" ? "stories" : "characters"}/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "작품을 삭제하지 못했어요.");
        return;
      }

      setLibrary((current) => ({
        ...current,
        ownWorlds: current.ownWorlds.filter((work) => !(item.type === "world" && work.id === item.id)),
        ownStories: current.ownStories.filter((work) => !(item.type === "story" && work.id === item.id)),
        ownCharacters: current.ownCharacters.filter((work) => !(item.type === "character" && work.id === item.id))
      }));
    });
  };

  return (
    <section className="wrap pb-16">
      <div className="works-head library-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>보관함</h1>
          <span>내가 만든 작품과 참여 중인 채팅을 한곳에서 정리합니다.</span>
        </div>
        <div className="flex gap-2">
          <Link href="/create/world" className="btn btn-ghost">
            <Plus size={16} /> 세계관 만들기
          </Link>
          <Link href="/create/story" className="btn btn-primary">
            <Plus size={16} /> 스토리 만들기
          </Link>
          <Link href="/create/character" className="btn btn-ghost">
            <Plus size={16} /> 캐릭터 만들기
          </Link>
        </div>
      </div>

      <div className="stat-cards">
        <div className="scard accent">
          <div className="n">{counts.own}</div>
          <div className="l">내작품</div>
        </div>
        <div className="scard">
          <div className="n">{counts.participating}</div>
          <div className="l">참여작품</div>
        </div>
        <div className="scard">
          <div className="n">{counts.chats}</div>
          <div className="l">진행 중인 채팅</div>
        </div>
      </div>

      {loading ? <div className="empty-card">보관함을 불러오는 중입니다.</div> : null}
      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="library-shell">
          <div className="library-main-tabs">
            <button type="button" className={mainTab === "own" ? "on" : ""} onClick={() => setMainTab("own")}>
              내작품
            </button>
            <button type="button" className={mainTab === "participating" ? "on" : ""} onClick={() => setMainTab("participating")}>
              참여작품
            </button>
          </div>

          {mainTab === "own" ? (
            <section className="library-section">
              <OwnLibraryTabs active={ownTab} onChange={setOwnTab} />
              {ownTab === "worlds" ? (
                <div className="book-shelf">
                  {ownItems.length ? (
                    ownItems.map((item) => (
                      <OwnWorldBook
                        key={item.id}
                        item={item}
                        token={token}
                        onRefresh={() => loadLibrary(token)}
                        onDelete={deleteWork}
                        deleting={isPending}
                      />
                    ))
                  ) : (
                    <EmptyLibrary label="아직 만든 세계관이 없습니다." href="/create/world" />
                  )}
                </div>
              ) : ownTab === "stories" ? (
                <div className="book-shelf">
                  {ownItems.length ? ownItems.map((item) => <OwnStoryBook key={item.id} item={item} onDelete={deleteWork} deleting={isPending} />) : <EmptyLibrary label="아직 만든 스토리가 없습니다." href="/create/story" />}
                </div>
              ) : (
                <div className="character-shelf">
                  {ownItems.length ? ownItems.map((item) => <OwnCharacterCard key={item.id} item={item} onDelete={deleteWork} deleting={isPending} />) : <EmptyLibrary label="아직 만든 캐릭터가 없습니다." href="/create/character" />}
                </div>
              )}
            </section>
          ) : (
            <section className="library-section">
              <LibrarySubTabs
                leftLabel="진행 중인 스토리 채팅"
                rightLabel="진행 중인 캐릭터 채팅"
                active={participatingTab}
                onChange={(value) => {
                  setParticipatingTab(value as ParticipatingTab);
                  setOpenGroupKey("");
                }}
              />
              <div className={participatingTab === "stories" ? "book-shelf participating" : "character-shelf participating"}>
                {participatingGroups.length ? (
                  participatingGroups.map((group) => (
                    <ParticipationCard
                      key={`${group.item.type}:${group.item.id}`}
                      group={group}
                      open={openGroupKey === `${group.item.type}:${group.item.id}`}
                      onToggle={() => setOpenGroupKey((current) => (current === `${group.item.type}:${group.item.id}` ? "" : `${group.item.type}:${group.item.id}`))}
                    />
                  ))
                ) : (
                  <EmptyLibrary label={participatingTab === "stories" ? "진행 중인 스토리 채팅이 없습니다." : "진행 중인 캐릭터 채팅이 없습니다."} href={participatingTab === "stories" ? "/stories" : "/characters"} />
                )}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </section>
  );
}

function LibrarySubTabs({
  leftLabel,
  rightLabel,
  active,
  onChange
}: {
  leftLabel: string;
  rightLabel: string;
  active: "stories" | "characters";
  onChange: (value: "stories" | "characters") => void;
}) {
  return (
    <div className="library-sub-tabs">
      <button type="button" className={active === "stories" ? "on" : ""} onClick={() => onChange("stories")}>
        <BookOpen size={15} /> {leftLabel}
      </button>
      <button type="button" className={active === "characters" ? "on" : ""} onClick={() => onChange("characters")}>
        <Bot size={15} /> {rightLabel}
      </button>
    </div>
  );
}

function OwnLibraryTabs({ active, onChange }: { active: OwnTab; onChange: (value: OwnTab) => void }) {
  return (
    <div className="library-sub-tabs">
      <button type="button" className={active === "worlds" ? "on" : ""} onClick={() => onChange("worlds")}>
        <Globe2 size={15} /> 세계관
      </button>
      <button type="button" className={active === "stories" ? "on" : ""} onClick={() => onChange("stories")}>
        <BookOpen size={15} /> 스토리
      </button>
      <button type="button" className={active === "characters" ? "on" : ""} onClick={() => onChange("characters")}>
        <Bot size={15} /> 독립 캐릭터
      </button>
    </div>
  );
}

function OwnWorldBook({
  item,
  token,
  onRefresh,
  onDelete,
  deleting
}: {
  item: LibraryWork;
  token: string;
  onRefresh: () => void;
  onDelete: (item: LibraryWork) => void;
  deleting: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const toggleVisibility = async () => {
    if (!token || busy) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/worlds/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ visibility: item.visibility === "public" ? "private" : "public" })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        window.alert(data.error ?? "세계관 공개 상태를 바꾸지 못했습니다.");
        return;
      }

      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="library-book">
      <Link href={`/worlds/${item.id}`} className="library-cover">
        <img src={item.imageUrl || fallbackStoryImage} alt="" />
        <span>{item.visibility === "public" ? "공개" : "비공개"}</span>
      </Link>
      <div className="library-book-meta">
        <Link href={`/worlds/${item.id}`} className="library-title">{item.title}</Link>
        <p>{item.description || "세계관 소개가 없습니다."}</p>
        <div className="library-actions">
          <Link href={`/worlds/${item.id}`}><Globe2 size={14} /> 관리</Link>
          <button type="button" disabled={busy} onClick={toggleVisibility}>
            {item.visibility === "public" ? "비공개" : "공개"}
          </button>
          <button type="button" disabled={deleting} onClick={() => onDelete(item)}><Trash2 size={14} /> 삭제</button>
        </div>
      </div>
    </article>
  );
}

function OwnStoryBook({ item, onDelete, deleting }: { item: LibraryWork; onDelete: (item: LibraryWork) => void; deleting: boolean }) {
  return (
    <article className="library-book">
      <Link href={`/stories/${item.id}`} className="library-cover">
        <img src={item.imageUrl || fallbackStoryImage} alt="" />
        <span>{item.visibility === "public" ? "공개" : "비공개"}</span>
      </Link>
      <div className="library-book-meta">
        <Link href={`/stories/${item.id}`} className="library-title">{item.title}</Link>
        <p>{item.description || "소개가 없습니다."}</p>
        <div className="library-actions">
          <Link href={`/edit/story/${item.id}`}><Edit3 size={14} /> 수정</Link>
          <button type="button" onClick={() => copyShareLink(item)}><Share2 size={14} /> 공유</button>
          <button type="button" disabled={deleting} onClick={() => onDelete(item)}><Trash2 size={14} /> 삭제</button>
        </div>
      </div>
    </article>
  );
}

function OwnCharacterCard({ item, onDelete, deleting }: { item: LibraryWork; onDelete: (item: LibraryWork) => void; deleting: boolean }) {
  return (
    <article className="library-character">
      <Link href={`/characters/${item.id}`} className="library-character-image">
        <img src={item.imageUrl || fallbackCharacterImage} alt="" />
      </Link>
      <div className="library-character-body">
        <Link href={`/characters/${item.id}`} className="library-title">{item.title}</Link>
        <p>{item.description || "소개가 없습니다."}</p>
        <span>{item.visibility === "public" ? "공개 캐릭터" : "비공개 캐릭터"}</span>
      </div>
      <div className="library-actions">
        <Link href={`/edit/character/${item.id}`}><Edit3 size={14} /> 수정</Link>
        <button type="button" onClick={() => copyShareLink(item)}><Share2 size={14} /> 공유</button>
        <button type="button" disabled={deleting} onClick={() => onDelete(item)}><Trash2 size={14} /> 삭제</button>
      </div>
    </article>
  );
}

function ParticipationCard({ group, open, onToggle }: { group: ParticipationGroup; open: boolean; onToggle: () => void }) {
  const item = group.item;
  const href = item.type === "story" ? `/stories/${item.id}` : `/characters/${item.id}`;
  const image = item.imageUrl || (item.type === "story" ? fallbackStoryImage : fallbackCharacterImage);

  return (
    <article className={`participation-card ${item.type === "character" ? "character" : ""}`}>
      <div className="participation-main">
        <Link href={href} className="participation-image">
          <img src={image} alt="" />
        </Link>
        <div className="participation-meta">
          <Link href={href} className="library-title">{item.title}</Link>
          <p>{item.description || "소개가 없습니다."}</p>
          <span>{group.sessions.length}개 채팅 · 최근 {formatDate(item.updatedAt)}</span>
        </div>
        <button type="button" className="participation-toggle" onClick={onToggle} aria-expanded={open}>
          <ChevronDown size={18} className={open ? "open" : ""} />
        </button>
      </div>
      {open ? (
        <div className="participation-sessions">
          {group.sessions.map((session) => (
            <Link key={session.id} href={`/chat/${session.id}`} className="session-row">
              <MessageCircle size={15} />
              <span>{session.title || item.title}</span>
              <small>{session.pinned ? "고정 · " : ""}{formatDate(session.updatedAt)}</small>
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function EmptyLibrary({ label, href }: { label: string; href: string }) {
  return (
    <div className="empty-card library-empty">
      <p>{label}</p>
      <Link href={href}>바로 이동</Link>
    </div>
  );
}

function copyShareLink(item: LibraryWork) {
  const path = item.type === "story" ? "stories" : "characters";
  void navigator.clipboard?.writeText(`${location.origin}/${path}/${item.id}`);
}

function formatDate(value?: string) {
  if (!value) return "최근";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}
