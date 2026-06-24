"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, ImagePlus, Loader2, Save, Upload, X } from "lucide-react";

type CreatorType = "story" | "character";
type UploadState = "idle" | "uploading" | "uploaded" | "error";
type Visibility = "public" | "private";

type Field = {
  name: string;
  label: string;
  type: "input" | "textarea";
  placeholder: string;
  rows?: number;
};

type Section = {
  id: string;
  title: string;
  description: string;
  fields: Field[];
};

type Draft = Record<string, string>;

const storySections: Section[] = [
  {
    id: "basic",
    title: "기본 정보",
    description: "탐색 화면과 상세 페이지에 보여질 정보를 적어주세요.",
    fields: [
      { name: "title", label: "스토리 제목", type: "input", placeholder: "예: 밤의 기록 보관소" },
      { name: "description", label: "짧은 소개", type: "textarea", placeholder: "카드에 보여질 소개 문구를 적어주세요.", rows: 3 },
      { name: "tags", label: "태그", type: "input", placeholder: "판타지, 로맨스, 사건" }
    ]
  },
  {
    id: "world",
    title: "세계관",
    description: "AI가 반드시 기억해야 하는 배경, 규칙, 금지사항입니다.",
    fields: [
      { name: "world", label: "세계관 설명", type: "textarea", placeholder: "시대, 장소, 세력, 사건 구조, 금지 규칙", rows: 8 },
      { name: "ai_rules", label: "AI 행동 규칙", type: "textarea", placeholder: "NPC 행동 방식, 문체, 진행 속도, 사건 전개 방식", rows: 8 }
    ]
  },
  {
    id: "characters",
    title: "등장인물",
    description: "스토리 안에 등장할 캐릭터와 NPC 정보를 적습니다.",
    fields: [
      { name: "characters", label: "등장인물 목록", type: "textarea", placeholder: "이름 / 역할 / 성격 / 말투 / 비밀 / 관계", rows: 10 }
    ]
  },
  {
    id: "scenes",
    title: "시작 상황",
    description: "유저가 첫 채팅 전에 마주하는 오프닝 장면입니다.",
    fields: [
      { name: "opening_message", label: "오프닝 메시지", type: "textarea", placeholder: "유저가 짧게 입력해도 이어질 첫 장면", rows: 5 },
      { name: "current_scene", label: "현재 상황", type: "textarea", placeholder: "날짜, 장소, 분위기, 직전 사건, NPC의 현재 행동", rows: 5 },
      { name: "status_text", label: "상태 정보", type: "textarea", placeholder: "예: #001 | 밤 9:40 | 기록 보관소 | 긴장", rows: 3 }
    ]
  },
  {
    id: "prompt",
    title: "시스템 프롬프트",
    description: "Gemini에 들어갈 최종 지시문입니다. 비워두면 위 내용을 합쳐 자동 생성합니다.",
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
      { name: "description", label: "간단한 소개", type: "textarea", placeholder: "캐릭터를 보여주는 짧은 소개", rows: 3 },
      { name: "first_message", label: "첫 메시지", type: "textarea", placeholder: "채팅방을 처음 열었을 때 보일 캐릭터의 첫 대사", rows: 5 }
    ]
  },
  {
    id: "detail",
    title: "캐릭터 상세",
    description: "성격, 말투, 관계와 비밀을 정리합니다.",
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

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80";
const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export function CreatorLongForm({ type }: { type: CreatorType }) {
  const router = useRouter();
  const sections = type === "story" ? storySections : characterSections;
  const storageKey = `lime-${type}-draft`;
  const imageField = type === "story" ? "thumbnail_url" : "avatar_url";
  const [draft, setDraft] = useState<Draft>({});
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { draft?: Draft; imageUrl?: string; savedSections?: Record<string, boolean> };
      setDraft(parsed.draft ?? {});
      setImageUrl(parsed.imageUrl ?? parsed.draft?.[imageField] ?? "");
      setSavedSections(parsed.savedSections ?? {});
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [imageField, storageKey]);

  const preview = useMemo(() => buildPreview(type, draft, imageUrl), [draft, imageUrl, type]);

  const persistDraft = (nextDraft: Draft, nextImageUrl: string, nextSavedSections: Record<string, boolean>) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ draft: nextDraft, imageUrl: nextImageUrl, savedSections: nextSavedSections })
    );
  };

  const updateField = (name: string, value: string) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setNotice("");
  };

  const saveDraft = (sectionId?: string) => {
    const nextSavedSections = sectionId ? { ...savedSections, [sectionId]: true } : savedSections;
    setSavedSections(nextSavedSections);
    persistDraft(draft, imageUrl, nextSavedSections);
    setNotice(sectionId ? "이 파트를 임시 저장했어요." : "전체 임시 저장을 완료했어요.");
  };

  const uploadImage = async (file: File) => {
    setUploadState("uploading");
    setSaveError("");
    setNotice("");

    const formData = new FormData();
    formData.set("image", file);
    formData.set("usage", type);

    try {
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "이미지 업로드에 실패했습니다.");
      }

      const nextDraft = { ...draft, [imageField]: data.url };
      setImageUrl(data.url);
      setDraft(nextDraft);
      setUploadState("uploaded");
      persistDraft(nextDraft, data.url, savedSections);
      setNotice("이미지가 업로드되어 미리보기에 반영됐어요.");
    } catch (error) {
      setUploadState("error");
      setSaveError(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    }
  };

  const saveWork = async (visibility: Visibility) => {
    setSaving(true);
    setSaveError("");
    setNotice("");
    persistDraft(draft, imageUrl, savedSections);

    const endpoint = type === "story" ? "/api/stories" : "/api/characters";
    const payload = { ...draft, [imageField]: imageUrl, visibility };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }

      window.localStorage.removeItem(storageKey);
      router.push(type === "story" ? `/stories/${data.id}` : `/characters/${data.id}`);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 ui-panel-card p-3">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#f7f7f8]">
              <span>{section.title}</span>
              {savedSections[section.id] ? <Check size={15} className="text-[#4d6b00]" /> : null}
            </a>
          ))}
          <button type="button" onClick={() => setPreviewOpen(true)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#a3e635] text-sm font-extrabold text-[#1a2e05]">
            <Eye size={16} /> 미리보기
          </button>
        </div>
      </aside>

      <form id={`${type}-creator-form`} className="space-y-5" onSubmit={(event) => event.preventDefault()}>
        <section className="ui-panel-card border-dashed p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f7f7f8] text-[#4d6b00]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="업로드 이미지 미리보기" className="size-full object-cover" />
              ) : (
                <ImagePlus size={30} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{type === "story" ? "대표 이미지" : "캐릭터 이미지"}</h2>
              <p className="mt-1 text-sm leading-6 text-[#6b7280]">jpg, png, webp, gif 파일을 업로드합니다. 업로드된 URL은 저장 시 데이터베이스에 함께 들어갑니다.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#ececef] px-3 text-sm font-semibold hover:bg-[#f7f7f8]">
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
                <span className="text-xs text-[#6b7280]">{uploadLabel(uploadState)}</span>
              </div>
            </div>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="ui-panel-card p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{section.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#6b7280]">{section.description}</p>
              </div>
              <button type="button" onClick={() => saveDraft(section.id)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#ececef] px-3 text-sm font-semibold hover:bg-[#f7f7f8]">
                <Save size={15} /> 파트 저장
              </button>
            </div>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <label key={field.name} htmlFor={field.name} className="block">
                  <span className="mb-2 block text-sm font-semibold">{field.label}</span>
                  {field.type === "input" ? (
                    <input
                      id={field.name}
                      name={field.name}
                      value={draft[field.name] ?? ""}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#ececef] bg-[#f7f7f8] px-3 outline-none focus:border-[#a3e635]"
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={draft[field.name] ?? ""}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      className="w-full resize-y rounded-xl border border-[#ececef] bg-[#f7f7f8] p-3 leading-6 outline-none focus:border-[#a3e635]"
                      placeholder={field.placeholder}
                      rows={field.rows ?? 4}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}

        <div className="flex flex-col items-end gap-2">
          {notice ? <p className="text-sm font-semibold text-[#4d6b00]">{notice}</p> : null}
          {saveError ? <p className="text-sm font-semibold text-red-600">{saveError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold hover:bg-[#f7f7f8]">
              <Eye size={16} /> 미리보기
            </button>
            <button type="button" onClick={() => saveDraft()} className="h-10 rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold hover:bg-[#f7f7f8]">
              임시저장
            </button>
            <button type="button" disabled={saving} onClick={() => void saveWork("private")} className="h-10 rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold disabled:opacity-50">
              비공개 저장
            </button>
            <button type="button" disabled={saving} onClick={() => void saveWork("public")} className="h-10 rounded-lg bg-[#a3e635] px-4 text-sm font-extrabold text-[#1a2e05] disabled:opacity-50">
              {saving ? "저장 중..." : "게시"}
            </button>
          </div>
        </div>
      </form>

      <aside className="hidden xl:block">
        <div className="sticky top-20">
          <PreviewCard type={type} preview={preview} />
        </div>
      </aside>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/35 px-4 py-8">
          <div className="mx-auto max-w-lg">
            <div className="mb-3 flex justify-end">
              <button type="button" aria-label="미리보기 닫기" onClick={() => setPreviewOpen(false)} className="grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <X size={18} />
              </button>
            </div>
            <PreviewCard type={type} preview={preview} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewCard({ type, preview }: { type: CreatorType; preview: ReturnType<typeof buildPreview> }) {
  return (
    <div className="ui-panel-card overflow-hidden">
      <div className="relative aspect-[3/4] bg-[#e7e8ea]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.image} alt="" className="size-full object-cover" />
        <span className="absolute left-3 top-3 rounded-md bg-[#a3e635] px-2 py-1 text-[10px] font-extrabold text-[#1a2e05]">
          {type === "story" ? "STORY" : "CHARACTER"}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="font-story text-xl font-bold leading-snug">{preview.title}</h3>
        <p className="line-clamp-3 text-sm leading-6 text-[#6b7280]">{preview.description}</p>
        {type === "story" ? (
          <div className="flex flex-wrap gap-1">
            {preview.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#ecfccb] px-2 py-1 text-xs font-semibold text-[#4d6b00]">#{tag}</span>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-[#f7f7f8] p-3 text-sm leading-6 text-[#4b5563]">{preview.firstMessage}</p>
        )}
      </div>
    </div>
  );
}

function buildPreview(type: CreatorType, draft: Draft, imageUrl: string) {
  if (type === "story") {
    return {
      title: draft.title || "스토리 제목 미리보기",
      description: draft.description || "작품 소개가 여기에 표시됩니다.",
      image: imageUrl || fallbackStoryImage,
      tags: (draft.tags || "미리보기").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
      firstMessage: ""
    };
  }

  return {
    title: draft.name || "캐릭터 이름 미리보기",
    description: draft.description || "캐릭터 소개가 여기에 표시됩니다.",
    image: imageUrl || fallbackCharacterImage,
    tags: [],
    firstMessage: draft.first_message || "첫 메시지가 여기에 표시됩니다."
  };
}

function uploadLabel(state: UploadState) {
  if (state === "uploading") return "업로드 중...";
  if (state === "uploaded") return "이미지 업로드 완료";
  if (state === "error") return "업로드 실패";
  return "최대 8MB";
}
