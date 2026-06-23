"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Save, Upload } from "lucide-react";

type Section = {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: "input" | "textarea";
    placeholder: string;
    rows?: number;
  }>;
};

type UploadState = "idle" | "uploading" | "uploaded" | "error";

const storySections: Section[] = [
  {
    id: "basic",
    title: "기본 정보",
    description: "탐색 페이지와 작품 상세에 표시되는 정보입니다.",
    fields: [
      { name: "title", label: "스토리 제목", type: "input", placeholder: "예: 서울에 용이 너무 많아" },
      { name: "description", label: "짧은 소개", type: "textarea", placeholder: "작품 카드에 보일 두세 문장 소개", rows: 3 },
      { name: "tags", label: "태그", type: "input", placeholder: "현대판타지, 용, 수사" }
    ]
  },
  {
    id: "world",
    title: "세계관",
    description: "AI가 잊으면 안 되는 배경, 규칙, 금지선을 정리합니다.",
    fields: [
      { name: "world", label: "세계관 설명", type: "textarea", placeholder: "시대, 장소, 세력, 사건 구조, 금지 규칙", rows: 8 },
      { name: "ai_rules", label: "AI 행동 규칙", type: "textarea", placeholder: "NPC 행동 방식, 문체, 진행 속도, 사건 전개 방식", rows: 8 }
    ]
  },
  {
    id: "characters",
    title: "등장인물",
    description: "스토리 안에서 움직일 캐릭터와 NPC 정보를 적습니다.",
    fields: [
      { name: "characters", label: "등장인물 목록", type: "textarea", placeholder: "이름 / 역할 / 성격 / 말투 / 비밀 / 관계", rows: 10 }
    ]
  },
  {
    id: "scenes",
    title: "시작 상황",
    description: "유저가 첫 채팅 전에 마주하는 오프닝 장면입니다.",
    fields: [
      { name: "opening_message", label: "오프닝 메시지", type: "textarea", placeholder: "유저가 안녕하세요만 입력해도 이어질 첫 장면", rows: 5 },
      { name: "current_scene", label: "현재 상황", type: "textarea", placeholder: "날짜, 장소, 분위기, 직전 사건, NPC의 현재 행동", rows: 5 },
      { name: "status_text", label: "상태 정보", type: "textarea", placeholder: "예: #001 | 밤 9:40 | DMA VIP실 | 긴장 | 비", rows: 3 }
    ]
  },
  {
    id: "prompt",
    title: "시스템 프롬프트",
    description: "Gemini에 들어갈 최종 지시문입니다.",
    fields: [
      { name: "system_prompt", label: "system_prompt", type: "textarea", placeholder: "세계관, NPC, 진행 규칙을 통합해서 작성", rows: 12 }
    ]
  }
];

const characterSections: Section[] = [
  {
    id: "basic",
    title: "캐릭터 설정",
    description: "캐릭터가 어떻게 보이고 소개될지 결정합니다.",
    fields: [
      { name: "name", label: "캐릭터 이름", type: "input", placeholder: "유저가 캐릭터를 어떻게 부르면 좋을지" },
      { name: "description", label: "간단한 소개", type: "textarea", placeholder: "어떤 캐릭터인지 보여주는 짧은 소개", rows: 3 },
      { name: "first_message", label: "첫 메시지", type: "textarea", placeholder: "채팅방을 처음 열었을 때 보일 캐릭터의 첫 대사", rows: 5 }
    ]
  },
  {
    id: "detail",
    title: "캐릭터 상세",
    description: "성격, 말투, 관계, 비밀을 정리합니다.",
    fields: [
      { name: "personality", label: "성격", type: "textarea", placeholder: "겉으로 보이는 성격과 숨겨진 내면", rows: 6 },
      { name: "speech_style", label: "말투", type: "textarea", placeholder: "문장 길이, 호칭, 자주 쓰는 표현", rows: 5 },
      { name: "relationship", label: "관계와 기억", type: "textarea", placeholder: "유저와의 기본 관계, 반드시 기억해야 할 정보", rows: 5 }
    ]
  },
  {
    id: "prompt",
    title: "프롬프트",
    description: "AI가 캐릭터성을 유지하기 위한 핵심 지시문입니다.",
    fields: [
      { name: "prompt", label: "캐릭터 프롬프트", type: "textarea", placeholder: "캐릭터 붕괴 방지 규칙과 반응 원칙", rows: 12 }
    ]
  }
];

export function CreatorLongForm({ type }: { type: "story" | "character" }) {
  const router = useRouter();
  const sections = type === "story" ? storySections : characterSections;
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const uploadImage = async (file: File) => {
    setUploadState("uploading");
    const formData = new FormData();
    formData.set("image", file);
    formData.set("usage", type);

    try {
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("upload failed");
      }

      const data = (await response.json()) as { url: string };
      setImageUrl(data.url);
      setUploadState("uploaded");
    } catch {
      setUploadState("error");
    }
  };

  const saveWork = async (visibility: "public" | "private") => {
    const form = document.getElementById(`${type}-creator-form`) as HTMLFormElement | null;
    if (!form) return;

    setSaving(true);
    setSaveError("");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = type === "story" ? "/api/stories" : "/api/characters";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, visibility })
      });

      if (!response.ok) throw new Error("save failed");

      const data = (await response.json()) as { id: string };
      router.push(type === "story" ? `/stories/${data.id}` : "/characters");
      router.refresh();
    } catch {
      setSaveError("저장에 실패했습니다. Supabase 설정 또는 입력값을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id={`${type}-creator-form`} className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-lg border border-[#e0ead4] bg-white p-3">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-leaf-50">
              <span>{section.title}</span>
              {savedSections[section.id] ? <Check size={15} className="text-leaf-600" /> : null}
            </a>
          ))}
        </div>
      </aside>

      <div className="space-y-5">
        <section className="rounded-lg border border-dashed border-[#cfe2c0] bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-leaf-50 text-leaf-900">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus size={28} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{type === "story" ? "대표 이미지" : "캐릭터 이미지"}</h2>
              <p className="mt-1 text-sm text-[#66705f]">
                jpg, png, webp, gif 파일을 업로드합니다. Supabase가 연결되면 Storage에 저장되고, 지금은 미리보기 URL로 동작합니다.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#dce8d1] px-3 text-sm font-medium hover:bg-leaf-50">
                  {uploadState === "uploading" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  이미지 선택
                  <input
                    id={`${type}-image-upload`}
                    name={`${type}_image`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                    }}
                  />
                </label>
                <span className="text-xs text-[#7a866f]">
                  {uploadState === "uploading"
                    ? "업로드 중..."
                    : uploadState === "uploaded"
                      ? "이미지 적용됨"
                      : uploadState === "error"
                        ? "업로드 실패"
                        : "최대 8MB"}
                </span>
              </div>
              <input type="hidden" name={type === "story" ? "thumbnail_url" : "avatar_url"} value={imageUrl} />
            </div>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="rounded-lg border border-[#e0ead4] bg-white p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="mt-1 text-sm text-[#66705f]">{section.description}</p>
              </div>
              <button
                onClick={() => setSavedSections((current) => ({ ...current, [section.id]: true }))}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[#dce8d1] px-3 text-sm hover:bg-leaf-50"
              >
                <Save size={15} /> 파트 저장
              </button>
            </div>
            <div className="space-y-4">
              {section.fields.map((field) => {
                const fieldName = field.name;

                return (
                <label key={field.label} htmlFor={fieldName} className="block">
                  <span className="mb-2 block text-sm font-medium">{field.label}</span>
                  {field.type === "input" ? (
                    <input id={fieldName} name={fieldName} className="h-11 w-full rounded-lg border border-[#dce8d1] px-3 outline-none focus:border-leaf-500" placeholder={field.placeholder} />
                  ) : (
                    <textarea id={fieldName} name={fieldName} className="w-full resize-y rounded-lg border border-[#dce8d1] p-3 leading-6 outline-none focus:border-leaf-500" placeholder={field.placeholder} rows={field.rows ?? 4} />
                  )}
                </label>
                );
              })}
            </div>
          </section>
        ))}

        <div className="flex flex-col items-end gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => void saveWork("private")} className="h-10 rounded-lg border border-[#dce8d1] bg-white px-4 text-sm font-semibold disabled:opacity-50">
              임시저장
            </button>
            <button type="button" disabled={saving} onClick={() => void saveWork("public")} className="h-10 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "저장 중..." : "게시"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
