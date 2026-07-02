"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StoryStartSetting } from "@/lib/types";

type StartChatButtonProps = {
  storyId: string;
  scene?: string;
  characterId?: string;
  title?: string;
  startSettings?: StoryStartSetting[];
};

export function StartChatButton({ storyId, scene, characterId, title, startSettings = [] }: StartChatButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectableSettings = useMemo(() => startSettings.filter((setting) => setting.mode === "free" || setting.openingMessage || setting.currentScene), [startSettings]);

  const startChat = (startSettingId?: string) => {
    setError("");
    setPickerOpen(false);
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;

      if (!session?.access_token) {
        router.push("/signup");
        return;
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ storyId, scene, characterId, title, startSettingId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "채팅방을 만들지 못했어요.");
        return;
      }

      const data = (await response.json()) as { id: string };
      router.push(`/chat/${data.id}`);
    });
  };

  const handleClick = () => {
    if (characterId || selectableSettings.length <= 1) {
      startChat(selectableSettings[0]?.id);
      return;
    }
    setPickerOpen(true);
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <button type="button" className="btn btn-primary" onClick={handleClick} disabled={isPending}>
        <MessageCircle size={18} /> {isPending ? "시작 중..." : "채팅 시작"}
      </button>
      {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-8" role="dialog" aria-modal="true" aria-label="시작 설정 선택">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ececef] px-5 py-4">
              <div>
                <p className="text-xs font-extrabold text-[#65a30d]">START SETTING</p>
                <h2 className="mt-1 text-xl font-extrabold text-[#111827]">어떤 시작으로 열까요?</h2>
              </div>
              <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-[#f4f4f5]" onClick={() => setPickerOpen(false)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70svh] space-y-3 overflow-y-auto p-4">
              {selectableSettings.map((setting) => (
                <button
                  key={setting.id}
                  type="button"
                  onClick={() => startChat(setting.id)}
                  className="w-full rounded-2xl border border-[#e5e7eb] bg-white p-4 text-left transition hover:border-[#a3e635] hover:bg-[#f7fee7]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#ecfccb] text-[#4d6b00]">
                      <Sparkles size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-extrabold text-[#111827]">{setting.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-[#6b7280]">{setting.description || setting.currentScene || "사용자 입력으로 장면을 시작합니다."}</span>
                      {setting.mode === "free" ? <span className="mt-2 inline-flex rounded-full bg-[#dcfce7] px-2 py-1 text-[11px] font-extrabold text-[#166534]">첫 입력부터 시작</span> : null}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
