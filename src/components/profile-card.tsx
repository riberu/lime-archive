"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";

type ProfileState = {
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  workCount: number;
};

const emptyProfile: ProfileState = {
  displayName: "",
  bio: "",
  avatarUrl: "",
  followerCount: 0,
  followingCount: 0,
  workCount: 0
};

export function ProfileCard() {
  const [profile, setProfile] = useState(emptyProfile);
  const [draft, setDraft] = useState(emptyProfile);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void fetch("/api/profile")
      .then((response) => response.json())
      .then((data: ProfileState) => {
        const next = { ...emptyProfile, ...data };
        setProfile(next);
        setDraft(next);
      })
      .catch(() => setError("프로필을 불러오지 못했습니다."));
  }, []);

  const save = () => {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName,
          bio: draft.bio,
          avatarUrl: draft.avatarUrl
        })
      });

      if (!response.ok) {
        setError("프로필을 저장하지 못했습니다.");
        return;
      }

      const data = (await response.json()) as Partial<ProfileState>;
      const next = { ...profile, ...data };
      setProfile(next);
      setDraft(next);
      setOpen(false);
    });
  };

  const displayName = profile.displayName || "프로필 이름을 등록해 주세요";
  const bio = profile.bio || "소개를 등록하면 이곳에 표시됩니다.";
  const initial = profile.displayName.slice(0, 1).toUpperCase() || "L";

  return (
    <>
      <div className="rounded-lg border border-[#e0ead4] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-16 place-items-center overflow-hidden rounded-full bg-leaf-100 text-xl font-semibold text-leaf-900">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <p className="mt-2 text-sm leading-6 text-[#66705f]">{bio}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#526047]">
              <span>등록 작품 {profile.workCount}</span>
              <span>팔로워 {profile.followerCount}</span>
              <span>팔로잉 {profile.followingCount}</span>
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
          <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-md border border-[#dce8d1] px-4 text-sm hover:bg-leaf-50">
            수정
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/30 px-4 py-8">
          <div className="mx-auto max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">내 정보 수정</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md hover:bg-leaf-50" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label htmlFor="profile-display-name" className="block">
                <span className="mb-2 block text-sm font-medium">닉네임</span>
                <input
                  id="profile-display-name"
                  name="display_name"
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#dce8d1] px-3 outline-none focus:border-leaf-500"
                />
              </label>
              <label htmlFor="profile-avatar-url" className="block">
                <span className="mb-2 block text-sm font-medium">프로필 이미지 URL</span>
                <input
                  id="profile-avatar-url"
                  name="avatar_url"
                  value={draft.avatarUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#dce8d1] px-3 outline-none focus:border-leaf-500"
                />
              </label>
              <label htmlFor="profile-bio" className="block">
                <span className="mb-2 block text-sm font-medium">소개</span>
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={draft.bio}
                  onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-[#dce8d1] p-3 leading-6 outline-none focus:border-leaf-500"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#dce8d1] px-4 text-sm font-semibold hover:bg-leaf-50">
                취소
              </button>
              <button type="button" disabled={isPending} onClick={save} className="h-10 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600 disabled:opacity-50">
                {isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
