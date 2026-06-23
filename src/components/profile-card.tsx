"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ProfileState = {
  displayName: string;
  bio: string;
};

const defaultProfile: ProfileState = {
  displayName: "리베루",
  bio: "스토리와 캐릭터를 만드는 작가 프로필입니다."
};

export function ProfileCard() {
  const [profile, setProfile] = useState(defaultProfile);
  const [draft, setDraft] = useState(defaultProfile);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("lime-profile");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as ProfileState;
      setProfile({ ...defaultProfile, ...parsed });
      setDraft({ ...defaultProfile, ...parsed });
    } catch {
      window.localStorage.removeItem("lime-profile");
    }
  }, []);

  const save = () => {
    const next = {
      displayName: draft.displayName.trim() || defaultProfile.displayName,
      bio: draft.bio.trim() || defaultProfile.bio
    };
    setProfile(next);
    window.localStorage.setItem("lime-profile", JSON.stringify(next));
    setOpen(false);
  };

  return (
    <>
      <div className="rounded-lg border border-[#e0ead4] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-leaf-100 text-xl font-semibold text-leaf-900">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{profile.displayName}</h1>
            <p className="mt-2 text-sm leading-6 text-[#66705f]">{profile.bio}</p>
            <div className="mt-4 flex gap-4 text-sm text-[#526047]">
              <span>활동 작품 5</span>
              <span>팔로워 0</span>
              <span>팔로잉 0</span>
            </div>
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
              <button type="button" onClick={save} className="h-10 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white hover:bg-leaf-600">
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
