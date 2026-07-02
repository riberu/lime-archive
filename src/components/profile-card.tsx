"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, LogOut, Pencil, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBlankPersona, getDefaultPersonas, type UserPersona } from "@/lib/personas";

type ProfileState = {
  id: string;
  authenticated: boolean;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  workCount: number;
  role?: string;
};

const emptyProfile: ProfileState = {
  id: "default",
  authenticated: false,
  email: "",
  displayName: "",
  bio: "",
  avatarUrl: "",
  followerCount: 0,
  followingCount: 0,
  workCount: 0,
  role: "user"
};

export function ProfileCard() {
  const [profile, setProfile] = useState<ProfileState>(emptyProfile);
  const [draft, setDraft] = useState<ProfileState>(emptyProfile);
  const [token, setToken] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const accessToken = session?.access_token ?? "";
      if (!accessToken) {
        clearLocalUserData();
        window.location.replace("/signup");
        return;
      }
      setToken(accessToken);
      await Promise.all([loadProfile(accessToken), loadPersonaList(accessToken)]);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token ?? "";
      if (!accessToken) {
        clearLocalUserData();
        window.location.replace("/signup");
        return;
      }
      setToken(accessToken);
      void loadProfile(accessToken);
      void loadPersonaList(accessToken);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = async (accessToken: string) => {
    setError("");
    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      const data = (await response.json()) as Partial<ProfileState> & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "프로필을 불러오지 못했어요.");
        return;
      }
      const next = { ...emptyProfile, ...data };
      setProfile(next);
      setDraft(next);
    } catch {
      setError("프로필을 불러오지 못했어요.");
    }
  };

  const loadPersonaList = async (accessToken: string) => {
    try {
      const response = await fetch("/api/personas", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error ?? "페르소나 정보를 불러오지 못했어요. 기본 페르소나를 임시로 표시합니다.");
        setPersonas(getDefaultPersonas());
        return;
      }

      const data = (await response.json()) as { personas?: UserPersona[] };
      setPersonas(data.personas?.length ? data.personas : getDefaultPersonas());
    } catch {
      setMessage("페르소나 정보를 불러오지 못했어요. 기본 페르소나를 임시로 표시합니다.");
      setPersonas(getDefaultPersonas());
    }
  };

  const openNewPersona = () => setEditingPersona(createBlankPersona());

  const savePersona = () => {
    if (!editingPersona) return;
    if (!editingPersona.name.trim()) {
      setError("페르소나 이름을 입력해 주세요.");
      return;
    }

    setError("");
    startTransition(async () => {
      const response = await fetch("/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingPersona)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "페르소나를 저장하지 못했어요.");
        return;
      }

      await loadPersonaList(token);
      setEditingPersona(null);
      setMessage("페르소나를 저장했어요.");
    });
  };

  const setDefaultPersona = (persona: UserPersona) => {
    startTransition(async () => {
      const response = await fetch("/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...persona, isDefault: true })
      });
      if (response.ok) await loadPersonaList(token);
    });
  };

  const deletePersona = (persona: UserPersona) => {
    if (!confirm("이 페르소나를 삭제할까요? 삭제 후에는 복원할 수 없어요.")) return;

    startTransition(async () => {
      const response = await fetch(`/api/personas?id=${encodeURIComponent(persona.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        setError("페르소나를 삭제하지 못했어요.");
        return;
      }

      await loadPersonaList(token);
    });
  };

  const save = () => {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders ?? {})
        },
        body: JSON.stringify({
          displayName: draft.displayName,
          bio: draft.bio,
          avatarUrl: draft.avatarUrl
        })
      });

      if (!response.ok) {
        setError("프로필을 저장하지 못했어요.");
        return;
      }

      const data = (await response.json()) as Partial<ProfileState>;
      const next = { ...profile, ...data };
      setProfile(next);
      setDraft(next);
      setIsEditing(false);
      setMessage("프로필을 저장했어요.");
    });
  };

  const uploadAvatar = (file: File) => {
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("image", file);
      formData.set("usage", "profile");

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "이미지를 업로드하지 못했어요.");
        return;
      }

      setDraft((current) => ({ ...current, avatarUrl: data.url ?? "" }));
      setProfile((current) => ({ ...current, avatarUrl: data.url ?? "" }));
      setMessage("이미지를 업로드했어요. 저장 버튼을 누르면 프로필에 반영돼요.");
    });
  };

  const changePassword = () => {
    if (newPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 해요.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setError("");
    startTransition(async () => {
      const { error: updateError } = await supabase?.auth.updateUser({ password: newPassword }) ?? { error: new Error("Supabase is not configured") };
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPasswordOpen(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      setMessage("비밀번호를 변경했어요.");
    });
  };

  const deleteAccount = () => {
    if (!confirm("정말 회원탈퇴할까요? 계정과 연결된 데이터는 복구할 수 없어요.")) return;
    if (!confirm("마지막 확인입니다. 탈퇴를 진행하면 로그아웃되고 계정이 삭제됩니다.")) return;

    const supabase = getSupabaseBrowserClient();
    startTransition(async () => {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "회원탈퇴를 처리하지 못했어요.");
        return;
      }
      await supabase?.auth.signOut();
      await fetch("/api/local-demo-data", { method: "DELETE" }).catch(() => undefined);
      clearLocalUserData();
      window.location.replace("/signup");
    });
  };

  const logout = () => {
    const supabase = getSupabaseBrowserClient();
    startTransition(async () => {
      await supabase?.auth.signOut();
      await fetch("/api/local-demo-data", { method: "DELETE" }).catch(() => undefined);
      clearLocalUserData();
      setToken("");
      setProfile(emptyProfile);
      setDraft(emptyProfile);
      setPersonas([]);
      window.location.replace("/signup");
    });
  };

  const displayName = profile.displayName || "라임 유저";
  const bio = profile.bio || "소개를 등록하면 프로필에 표시됩니다.";
  const initial = displayName.slice(0, 1).toUpperCase() || "L";

  return (
    <>
      <div className="profile-col">
        <div className="prof-head">
          <div className="av overflow-hidden">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-xl font-extrabold text-white">{initial}</span>
            )}
          </div>
          <div>
            <h1 className="nm">{displayName}</h1>
            <div className="em">{bio}</div>
            <div className="mt-1 text-xs font-semibold text-[var(--muted)]">
              {profile.email || "로그인됨"}
              {profile.role === "master" ? <span className="ml-2 rounded-full bg-[#ecfccb] px-2 py-0.5 text-[#3f6212]">마스터</span> : null}
            </div>
          </div>
          <button type="button" onClick={() => setIsEditing(true)} className="btn btn-ghost edit">
            프로필 편집
          </button>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mb-4 rounded-xl bg-[#ecfccb] px-4 py-3 text-sm font-semibold text-[#3f6212]">{message}</p> : null}

        <div className="set-group">
          <div className="gt">기본 정보</div>
          <div className="set-row"><span className="k">닉네임</span><span className="v">{displayName}</span></div>
          <Link href="/my" className="set-row">
            <span className="k">보관함</span>
            <span className="v link">{profile.workCount}개 보기</span>
          </Link>
          <div className="set-row"><span className="k">팔로워</span><span className="v">{profile.followerCount.toLocaleString("ko-KR")}</span></div>
          <div className="set-row"><span className="k">팔로잉</span><span className="v">{profile.followingCount.toLocaleString("ko-KR")}</span></div>
        </div>

        <div className="set-group">
          <div className="gt">서비스</div>
          <Link href="/wallet" className="set-row">
            <span className="k">라임 지갑</span>
            <span className="v link">잔액·출석·충전 관리</span>
          </Link>
        </div>

        <div className="set-group">
          <div className="gt row-title">
            내 페르소나
            <button type="button" className="mini-add" onClick={openNewPersona} aria-label="페르소나 추가">
              <Plus size={15} />
            </button>
          </div>
          <div className="locked-note">
            대표 페르소나는 채팅방 설정에서 기본으로 불러옵니다. 로그인한 계정에 저장됩니다.
          </div>
          {personas.map((persona) => (
            <div key={persona.id} className={`persona-item ${persona.isDefault ? "rep" : ""}`}>
              <div className="pi-main">
                <div className="pi-name">
                  {persona.name || "이름 없는 페르소나"} {persona.isDefault ? <span className="badge">대표</span> : null}
                </div>
                <div className="pi-desc">{persona.appearance || persona.memo || "외모, 말투, 추가 메모를 저장하면 채팅 설정에서 불러올 수 있습니다."}</div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="ui-icon-btn" onClick={() => setDefaultPersona(persona)} aria-label="대표로 설정">
                  {persona.isDefault ? <Check size={15} /> : <Star size={15} />}
                </button>
                <button type="button" className="ui-icon-btn" onClick={() => setEditingPersona(persona)} aria-label="페르소나 수정">
                  <Pencil size={15} />
                </button>
                <button type="button" className="ui-icon-btn" onClick={() => deletePersona(persona)} aria-label="페르소나 삭제">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="set-group">
          <div className="gt">알림 설정</div>
          <div className="set-row"><span className="k">출석 알림</span><div className="toggle on" /></div>
          <div className="set-row"><span className="k">공지 알림</span><div className="toggle on" /></div>
          <div className="set-row"><span className="k">이벤트 알림</span><div className="toggle" /></div>
        </div>

        <div className="set-group">
          <div className="gt">계정</div>
          <button type="button" className="set-row w-full text-left" onClick={logout} disabled={isPending || !profile.authenticated}>
            <span className="k inline-flex items-center gap-2"><LogOut size={15} /> 로그아웃</span>
            <span className="v link">나가기</span>
          </button>
          <button type="button" className="set-row w-full text-left" onClick={() => setPasswordOpen(true)} disabled={isPending || !profile.authenticated}>
            <span className="k">비밀번호 변경</span>
            <span className="v link">변경하기</span>
          </button>
          <button type="button" className="set-row w-full text-left" onClick={deleteAccount} disabled={isPending || !profile.authenticated}>
            <span className="k">회원 탈퇴</span>
            <span className="v danger">탈퇴하기</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <Modal title="내 정보 수정" onClose={() => setIsEditing(false)}>
          <div className="field">
            <label htmlFor="profile-display-name">닉네임</label>
            <input id="profile-display-name" name="display_name" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="profile-avatar-url">프로필 이미지</label>
            <div className="flex gap-2">
              <input id="profile-avatar-url" name="avatar_url" value={draft.avatarUrl} onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))} />
              <button type="button" className="ui-icon-btn" onClick={() => fileRef.current?.click()} aria-label="이미지 업로드">
                <Upload size={16} />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAvatar(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="profile-bio">소개</label>
            <textarea id="profile-bio" name="bio" value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} rows={5} />
          </div>
          <ModalActions onCancel={() => setIsEditing(false)} onSave={save} saving={isPending} />
        </Modal>
      ) : null}

      {passwordOpen ? (
        <Modal title="비밀번호 변경" onClose={() => setPasswordOpen(false)}>
          <div className="field">
            <label htmlFor="new-password">새 비밀번호</label>
            <input id="new-password" name="new_password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="8자 이상" />
          </div>
          <div className="field">
            <label htmlFor="new-password-confirm">새 비밀번호 확인</label>
            <input id="new-password-confirm" name="new_password_confirm" type="password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} />
          </div>
          <ModalActions onCancel={() => setPasswordOpen(false)} onSave={changePassword} saving={isPending} />
        </Modal>
      ) : null}

      {editingPersona ? (
        <Modal title="페르소나 편집" onClose={() => setEditingPersona(null)}>
          <PersonaField label="이름" value={editingPersona.name} onChange={(value) => setEditingPersona((current) => (current ? { ...current, name: value } : current))} />
          <PersonaField label="외모" value={editingPersona.appearance} onChange={(value) => setEditingPersona((current) => (current ? { ...current, appearance: value } : current))} textarea />
          <PersonaField label="말투" value={editingPersona.speechStyle} onChange={(value) => setEditingPersona((current) => (current ? { ...current, speechStyle: value } : current))} />
          <PersonaField label="추가 메모" value={editingPersona.memo} onChange={(value) => setEditingPersona((current) => (current ? { ...current, memo: value } : current))} textarea />
          <label className="agree mt-3">
            <input
              id="persona-default"
              name="persona_default"
              type="checkbox"
              checked={Boolean(editingPersona.isDefault)}
              onChange={(event) => setEditingPersona((current) => (current ? { ...current, isDefault: event.target.checked } : current))}
            />
            <span>대표 페르소나로 설정</span>
          </label>
          <ModalActions onCancel={() => setEditingPersona(null)} onSave={savePersona} saving={isPending} />
        </Modal>
      ) : null}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 px-4 py-8">
      <div className="mx-auto max-w-lg rounded-[16px] bg-[var(--surface)] p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-story text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="ui-icon-btn" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn btn-ghost">
        취소
      </button>
      <button type="button" disabled={saving} onClick={onSave} className="btn btn-primary">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

function PersonaField({
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
  const id = `persona-${label}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <input id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function clearLocalUserData() {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (
      key === "lime-user-personas" ||
      key === "lime-user-key" ||
      key === "lime-selected-persona" ||
      key.startsWith("lime-selected-persona-")
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
