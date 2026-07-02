"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Eye, FileText, ImagePlus, Loader2, Pencil, Plus, RotateCcw, Save, Sparkles, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { characterSections, storySections, type Field, type Section } from "@/lib/creator-form-config";
import type { StoryStartSetting } from "@/lib/types";

type CreatorType = "story" | "character";
type UploadState = "idle" | "uploading" | "uploaded" | "error";
type Visibility = "public" | "private";
type Draft = Record<string, string>;
type CreatorMode = "create" | "edit";

type StoryCastCharacter = {
  id: string;
  source: "existing" | "new";
  characterId?: string;
  name: string;
  description: string;
  gender: string;
  age: string;
  personality: string;
  speechStyle: string;
  memo: string;
  prompt: string;
  avatarUrl: string;
};

type ExistingCharacterOption = Omit<StoryCastCharacter, "source" | "memo"> & { firstMessage?: string };

function normalizeStoryCast(characters: StoryCastCharacter[]) {
  return characters.map((character) => ({
    ...character,
    gender: character.gender ?? "",
    age: character.age ?? "",
    memo: character.memo ?? ""
  }));
}

const fallbackStoryImage = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80";
const fallbackCharacterImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export function CreatorLongForm({
  type,
  mode = "create",
  itemId,
  initialDraft = {},
  initialImageUrl = "",
  initialStoryCast = [],
  initialStartSettings = [],
  characterScope = "independent",
  worldId
}: {
  type: CreatorType;
  mode?: CreatorMode;
  itemId?: string;
  initialDraft?: Draft;
  initialImageUrl?: string;
  initialStoryCast?: StoryCastCharacter[];
  initialStartSettings?: StoryStartSetting[];
  characterScope?: "independent" | "world";
  worldId?: string;
}) {
  const router = useRouter();
  const sections = type === "story" ? storySections : characterSections;
  const storageKey = mode === "edit" && itemId ? `lime-${type}-edit-${itemId}` : `lime-${type}-draft`;
  const imageField = type === "story" ? "thumbnail_url" : "avatar_url";
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [saving, setSaving] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [storyCast, setStoryCast] = useState<StoryCastCharacter[]>(initialStoryCast);
  const [startSettings, setStartSettings] = useState<StoryStartSetting[]>(() => normalizeEditableStartSettings(initialStartSettings, initialDraft));
  const [existingCharacters, setExistingCharacters] = useState<ExistingCharacterOption[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { draft?: Draft; imageUrl?: string; savedSections?: Record<string, boolean>; storyCast?: StoryCastCharacter[]; startSettings?: StoryStartSetting[] };
      setDraft({ ...initialDraft, ...(parsed.draft ?? {}) });
      setImageUrl(parsed.imageUrl ?? parsed.draft?.[imageField] ?? initialImageUrl);
      setSavedSections(parsed.savedSections ?? {});
      setStoryCast(Array.isArray(parsed.storyCast) ? normalizeStoryCast(parsed.storyCast) : initialStoryCast);
      setStartSettings(normalizeEditableStartSettings(parsed.startSettings ?? initialStartSettings, { ...initialDraft, ...(parsed.draft ?? {}) }));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [imageField, initialDraft, initialImageUrl, initialStartSettings, initialStoryCast, storageKey]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      setAuthToken(session?.access_token ?? "");
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? "");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (type !== "story" || !authToken) return;
    let ignore = false;
    void (async () => {
      const response = await fetch("/api/my/characters", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) return;
      const data = (await response.json()) as { characters?: ExistingCharacterOption[] };
      if (!ignore) setExistingCharacters(data.characters ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [authToken, type]);

  const preview = useMemo(() => buildPreview(type, draft, imageUrl), [draft, imageUrl, type]);
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  const currentSection = sections[activeIndex] ?? sections[0];
  const previousSection = sections[activeIndex - 1];
  const nextSection = sections[activeIndex + 1];

  const persistDraft = (nextDraft = draft, nextImageUrl = imageUrl, nextSavedSections = savedSections, nextStoryCast = storyCast, nextStartSettings = startSettings) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ draft: nextDraft, imageUrl: nextImageUrl, savedSections: nextSavedSections, storyCast: nextStoryCast, startSettings: nextStartSettings })
    );
  };

  const updateStoryCast = (nextStoryCast: StoryCastCharacter[]) => {
    setStoryCast(nextStoryCast);
    persistDraft(draft, imageUrl, savedSections, nextStoryCast, startSettings);
    setNotice("");
  };

  const updateStartSettings = (nextStartSettings: StoryStartSetting[]) => {
    const normalized = normalizeEditableStartSettings(nextStartSettings, draft);
    const primary = normalized[0];
    const nextDraft = {
      ...draft,
      opening_message: primary.openingMessage,
      current_scene: primary.currentScene,
      status_text: primary.statusText
    };
    setStartSettings(normalized);
    setDraft(nextDraft);
    persistDraft(nextDraft, imageUrl, savedSections, storyCast, normalized);
    setNotice("");
  };

  const updateField = (name: string, value: string) => {
    setDraft((current) => ({ ...current, [name]: value }));
    if (value.trim()) setMissingFields((current) => current.filter((fieldName) => fieldName !== name));
    setNotice("");
  };

  const saveDraft = (sectionId?: string) => {
    const targetSection = sectionId ?? activeSection;
    const nextSavedSections = { ...savedSections, [targetSection]: true };
    setSavedSections(nextSavedSections);
    persistDraft(draft, imageUrl, nextSavedSections);
    setNotice(sectionId ? "이 단계가 임시 저장됐어요." : "전체 임시 저장을 완료했어요.");
  };

  const uploadImage = async (file: File) => {
    setUploadState("uploading");
    setSaveError("");
    const formData = new FormData();
    formData.set("image", file);
    formData.set("usage", type);

    try {
      const response = await fetch("/api/uploads/image", { method: "POST", body: formData });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "이미지 업로드에 실패했습니다.");

      const nextDraft = { ...draft, [imageField]: data.url };
      setDraft(nextDraft);
      setImageUrl(data.url);
      setUploadState("uploaded");
      persistDraft(nextDraft, data.url, savedSections);
      setNotice("이미지가 업로드되고 미리보기에 반영됐어요.");
    } catch (error) {
      setUploadState("error");
      setSaveError(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    }
  };

  const requiredFields = sections.flatMap((section) =>
    section.fields.filter((field) => field.required).map((field) => ({ ...field, sectionId: section.id }))
  );

  const validateRequiredFields = () => {
    const missing = requiredFields.filter((field) => !draft[field.name]?.trim());
    if (!missing.length) {
      setMissingFields([]);
      return true;
    }
    const firstMissing = missing[0];
    setMissingFields(missing.map((field) => field.name));
    setActiveSection(firstMissing.sectionId);
    setSaveError(`필수 항목을 입력해 주세요: ${missing.map((field) => field.label).join(", ")}`);
    setNotice("");
    window.requestAnimationFrame(() => {
      document.getElementById("creator-form-top")?.scrollIntoView({ block: "start", behavior: "smooth" });
      window.setTimeout(() => document.getElementById(firstMissing.name)?.focus(), 250);
    });
    return false;
  };

  const saveWork = async (visibility: Visibility) => {
    if (!validateRequiredFields()) return;
    if (!authToken) {
      router.push("/signup");
      return;
    }
    setSaving(true);
    setSaveError("");
    setNotice("");
    persistDraft();
    try {
      const endpoint =
        mode === "edit" && itemId
          ? type === "story"
            ? `/api/stories/${itemId}`
            : `/api/characters/${itemId}`
          : type === "story"
            ? "/api/stories"
            : "/api/characters";
      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          ...draft,
          [imageField]: imageUrl,
          visibility,
          scope: type === "character" ? characterScope : undefined,
          worldId: type === "character" ? worldId : undefined,
          storyCharacters: type === "story" ? storyCast : undefined,
          startSettings: type === "story" ? startSettings : undefined
        })
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "저장에 실패했습니다.");
      window.localStorage.removeItem(storageKey);
      router.push(type === "story" ? `/stories/${data.id}` : `/characters/${data.id}`);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const jumpToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    window.history.replaceState(null, "", `#creator-section-${sectionId}`);
    document.getElementById("creator-form-top")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div id="creator-form-top" className="min-h-[calc(100svh-88px)] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#ececef] bg-white/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" aria-label="뒤로 가기" onClick={() => router.back()} className="grid size-10 place-items-center rounded-full hover:bg-[#f7f7f8]">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-extrabold">{type === "story" ? "스토리 만들기" : "캐릭터 만들기"}</h2>
              <span className="rounded-full bg-[#ecfccb] px-2 py-1 text-[11px] font-bold text-[#4d6b00]">Draft</span>
            </div>
            <p className="hidden text-xs text-[#6b7280] sm:block">단계별로 저장하면서 완성도를 올려보세요.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => saveDraft()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#ececef] bg-white px-3 text-sm font-semibold hover:bg-[#f7f7f8]">
            <Save size={15} /> 임시저장
          </button>
          <button type="button" onClick={() => window.location.reload()} className="hidden size-9 place-items-center rounded-lg border border-[#ececef] hover:bg-[#f7f7f8] sm:grid" aria-label="저장본 다시 불러오기">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="border-b border-[#ececef] bg-white">
        <div className="flex gap-2 overflow-x-auto px-4">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#creator-section-${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                jumpToSection(section.id);
              }}
              className={`relative flex h-12 shrink-0 items-center gap-1 border-b-2 px-2 text-sm font-bold transition ${
                activeSection === section.id ? "border-[#84cc16] text-[#1f2937]" : "border-transparent text-[#6b7280] hover:text-[#1f2937]"
              }`}
            >
              {section.shortTitle}
              {section.fields.some((field) => field.required) ? <span className="text-[#65a30d]">*</span> : null}
              {savedSections[section.id] ? <Check size={14} className="text-[#65a30d]" /> : null}
            </a>
          ))}
        </div>
      </div>

      <div className="grid min-h-[720px] lg:grid-cols-[1fr_340px]">
        <main className="min-w-0 border-r border-[#ececef] bg-[#fafafa]">
          <form
            className="mx-auto max-w-3xl space-y-5 px-4 py-6"
            action={type === "story" ? "/api/stories" : "/api/characters"}
            method="post"
            onSubmit={(event) => {
              event.preventDefault();
              const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              const visibility = submitter?.value === "public" ? "public" : "private";
              void saveWork(visibility);
            }}
          >
            <input type="hidden" name={imageField} value={imageUrl} />
            <ImageSection type={type} imageUrl={imageUrl} uploadState={uploadState} onUpload={uploadImage} onUseFallback={() => {
              const nextUrl = type === "story" ? fallbackStoryImage : fallbackCharacterImage;
              const nextDraft = { ...draft, [imageField]: nextUrl };
              setDraft(nextDraft);
              setImageUrl(nextUrl);
              persistDraft(nextDraft, nextUrl, savedSections);
            }} />

            <section key={currentSection.id} id={`creator-section-${currentSection.id}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-[#65a30d]" />
                    <h3 className="text-xl font-extrabold">{currentSection.title}</h3>
                    {currentSection.required ? <span className="text-sm font-bold text-[#65a30d]">*</span> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">{currentSection.description}</p>
                  <p className="mt-2 text-xs font-bold text-[#9ca3af]">
                    {activeIndex + 1} / {sections.length}
                  </p>
                </div>
                <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#f7fee7] px-3 text-xs font-bold text-[#4d6b00] hover:bg-[#ecfccb]">
                  <Eye size={14} /> 미리보기
                </button>
              </div>

              <div className="space-y-5">
                {type === "story" && currentSection.id === "characters" ? (
                  <StoryCastSection characters={storyCast} existingCharacters={existingCharacters} onChange={updateStoryCast} />
                ) : type === "story" && currentSection.id === "start" ? (
                  <StartSettingsSection settings={startSettings} onChange={updateStartSettings} />
                ) : (
                  currentSection.fields.map((field) => (
                    <FieldControl key={field.name} field={field} value={draft[field.name] ?? ""} error={missingFields.includes(field.name)} onChange={(value) => updateField(field.name, value)} />
                  ))
                )}
              </div>

              <SectionFooter
                notice={notice}
                saveError={saveError}
                visible
                saving={saving}
                previousSection={previousSection}
                nextSection={nextSection}
                onSave={() => saveDraft(currentSection.id)}
                onJump={jumpToSection}
                onPublish={saveWork}
              />
            </section>
          </form>
        </main>

        <aside className="hidden bg-white lg:block">
          <div className="sticky top-0 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">미리보기</h3>
              <button type="button" onClick={() => setPreviewOpen(true)} className="grid size-9 place-items-center rounded-lg border border-[#ececef] hover:bg-[#f7f7f8]" aria-label="미리보기 열기">
                <Eye size={16} />
              </button>
            </div>
            <PreviewCard type={type} preview={preview} />
          </div>
        </aside>
      </div>

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

function StartSettingsSection({ settings, onChange }: { settings: StoryStartSetting[]; onChange: (settings: StoryStartSetting[]) => void }) {
  const updateSetting = (id: string, patch: Partial<StoryStartSetting>) => {
    onChange(settings.map((setting) => (setting.id === id ? { ...setting, ...patch } : setting)));
  };

  const addSetting = () => {
    onChange([...settings, createBlankStartSetting(settings.length + 1)]);
  };

  const removeSetting = (id: string) => {
    const next = settings.filter((setting) => setting.id !== id);
    onChange(next.length ? next : [createBlankStartSetting(1)]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#d9f99d] bg-[#f7fee7] p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#a3e635] text-[#1a2e05]">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="font-extrabold text-[#1f2937]">자유시작</div>
            <p className="mt-1 text-sm leading-6 text-[#4b5563]">
              모든 스토리에 자동으로 포함됩니다. 오프닝 없이 사용자의 첫 입력을 장면 시작점으로 삼아 새 채팅방을 엽니다.
            </p>
          </div>
        </div>
      </div>

      {settings.map((setting, index) => (
        <div key={setting.id} className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-[#65a30d]">START {index + 1}</p>
              <h4 className="mt-1 font-extrabold text-[#111827]">{setting.title || `시작 설정 ${index + 1}`}</h4>
            </div>
            <button type="button" onClick={() => removeSetting(setting.id)} className="rounded-lg border border-[#fee2e2] px-3 py-2 text-xs font-bold text-[#dc2626] hover:bg-[#fef2f2]">
              삭제
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">시작설정 이름 *</span>
              <input
                value={setting.title}
                onChange={(event) => updateSetting(setting.id, { title: event.target.value })}
                className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="기본 설정"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">짧은 설명</span>
              <input
                value={setting.description}
                onChange={(event) => updateSetting(setting.id, { description: event.target.value })}
                className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="이 시작 설정의 분위기나 조건"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">프롤로그 / 오프닝 메시지 *</span>
              <textarea
                value={setting.openingMessage}
                onChange={(event) => updateSetting(setting.id, { openingMessage: event.target.value })}
                rows={5}
                className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="채팅방이 열렸을 때 먼저 보여줄 첫 장면을 입력해 주세요."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">시작 상황</span>
              <textarea
                value={setting.currentScene}
                onChange={(event) => updateSetting(setting.id, { currentScene: event.target.value })}
                rows={4}
                className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="시간, 장소, 직전 사건, 등장인물의 위치를 적어 주세요."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">상태값</span>
              <textarea
                value={setting.statusText}
                onChange={(event) => updateSetting(setting.id, { statusText: event.target.value })}
                rows={3}
                className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="#001 | 현재 장소 | 긴장도"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">플레이 가이드</span>
              <textarea
                value={setting.guide}
                onChange={(event) => updateSetting(setting.id, { guide: event.target.value })}
                rows={3}
                className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="사용자에게만 보여줄 플레이 안내를 적어 주세요."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">추천 답변</span>
              <textarea
                value={setting.suggestedReplies.join("\n")}
                onChange={(event) => updateSetting(setting.id, { suggestedReplies: event.target.value.split(/\r?\n/).map((reply) => reply.trim()).filter(Boolean).slice(0, 3) })}
                rows={3}
                className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]"
                placeholder="최대 3개까지 줄바꿈으로 입력"
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" onClick={addSetting} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f2937] px-4 text-sm font-bold text-white hover:bg-[#111827]">
        <Plus size={16} /> 시작 설정 추가
      </button>
    </div>
  );
}

function normalizeEditableStartSettings(settings: StoryStartSetting[], draft: Draft) {
  const sceneSettings = settings.filter((setting) => setting.mode === "scene");
  if (sceneSettings.length) {
    return sceneSettings.map((setting, index) => ({
      ...createBlankStartSetting(index + 1),
      ...setting,
      id: setting.id || makeLocalId()
    }));
  }

  return [
    {
      ...createBlankStartSetting(1),
      title: "기본 설정",
      openingMessage: draft.opening_message ?? "",
      currentScene: draft.current_scene ?? "",
      statusText: draft.status_text ?? ""
    }
  ];
}

function createBlankStartSetting(index: number): StoryStartSetting {
  return {
    id: makeLocalId(),
    mode: "scene",
    title: `시작 설정 ${index}`,
    description: "",
    openingMessage: "",
    currentScene: "",
    statusText: "",
    guide: "",
    suggestedReplies: []
  };
}

function makeLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ImageSection({ type, imageUrl, uploadState, onUpload, onUseFallback }: { type: CreatorType; imageUrl: string; uploadState: UploadState; onUpload: (file: File) => void; onUseFallback: () => void }) {
  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#f4f4f5] text-[#4d6b00]">
          {imageUrl ? <img src={imageUrl} alt="업로드 이미지 미리보기" className="size-full object-cover" /> : <ImagePlus size={30} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{type === "story" ? "대표 이미지" : "캐릭터 이미지"}</h3>
          <p className="mt-1 text-sm leading-6 text-[#6b7280]">최대 8MB까지 업로드할 수 있고, URL은 데이터베이스에 저장됩니다.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor={`${type}-image-upload`} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#a3e635] px-3 text-sm font-extrabold text-[#1a2e05] hover:bg-[#bef264]">
              {uploadState === "uploading" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              업로드
            </label>
            <button type="button" onClick={onUseFallback} className="h-9 rounded-lg border border-[#ececef] px-3 text-sm font-semibold hover:bg-[#f7f7f8]">
              기본 이미지 적용
            </button>
            <span className="text-xs text-[#6b7280]">{uploadLabel(uploadState)}</span>
          </div>
          <input
            id={`${type}-image-upload`}
            name={`${type}_image`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </div>
      </div>
    </section>
  );
}

function StoryCastSection({
  characters,
  existingCharacters,
  onChange
}: {
  characters: StoryCastCharacter[];
  existingCharacters: ExistingCharacterOption[];
  onChange: (characters: StoryCastCharacter[]) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState({
    name: "",
    description: "",
    gender: "",
    age: "",
    personality: "",
    speechStyle: "",
    memo: ""
  });
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    gender: "",
    age: "",
    personality: "",
    speechStyle: "",
    memo: ""
  });

  const selectedExisting = existingCharacters.find((character) => character.id === selectedId);
  const linkedExistingIds = new Set(characters.map((character) => character.characterId).filter(Boolean));

  const addExisting = () => {
    if (!selectedExisting || linkedExistingIds.has(selectedExisting.id)) return;
    onChange([
      ...characters,
      {
        ...selectedExisting,
        source: "existing",
        characterId: selectedExisting.id,
        gender: selectedExisting.gender ?? "",
        age: selectedExisting.age ?? "",
        memo: ""
      }
    ]);
    setSelectedId("");
  };

  const addNew = () => {
    const name = draft.name.trim();
    const personality = draft.personality.trim();
    const speechStyle = draft.speechStyle.trim();
    if (!name || !personality || !speechStyle) return;
    const description = draft.description.trim();
    const gender = draft.gender.trim();
    const age = draft.age.trim();
    const memo = draft.memo.trim();
    onChange([
      ...characters,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        source: "new",
        name,
        description,
        gender,
        age,
        personality,
        speechStyle,
        memo,
        prompt: buildStoryCastPrompt({ name, description, gender, age, personality, speechStyle, memo }),
        avatarUrl: ""
      }
    ]);
    setDraft({ name: "", description: "", gender: "", age: "", personality: "", speechStyle: "", memo: "" });
  };

  const removeCharacter = (id: string) => {
    if (editingId === id) {
      setEditingId("");
      setEditDraft({ name: "", description: "", gender: "", age: "", personality: "", speechStyle: "", memo: "" });
    }
    onChange(characters.filter((character) => character.id !== id));
  };

  const startEdit = (character: StoryCastCharacter) => {
    setEditingId(character.id);
    setEditDraft({
      name: character.name,
      description: character.description,
      gender: character.gender ?? "",
      age: character.age ?? "",
      personality: character.personality,
      speechStyle: character.speechStyle,
      memo: character.memo
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditDraft({ name: "", description: "", gender: "", age: "", personality: "", speechStyle: "", memo: "" });
  };

  const saveEdit = () => {
    const name = editDraft.name.trim();
        const gender = editDraft.gender.trim();
        const age = editDraft.age.trim();
        const personality = editDraft.personality.trim();
    const speechStyle = editDraft.speechStyle.trim();
    if (!editingId || !name || !personality || !speechStyle) return;

    onChange(
      characters.map((character) => {
        if (character.id !== editingId) return character;
        const description = editDraft.description.trim();
        const memo = editDraft.memo.trim();
        return {
          ...character,
          name,
          description,
          gender,
          age,
          personality,
          speechStyle,
          memo,
          prompt: buildStoryCastPrompt({ name, description, gender, age, personality, speechStyle, memo })
        };
      })
    );
    cancelEdit();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#dfe3e8] bg-[#fbfbfb] p-4">
        <div className="mb-3">
          <h4 className="text-sm font-extrabold text-[#1f2937]">내 캐릭터 불러오기</h4>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">이미 만들어둔 캐릭터를 이 스토리의 기본 등장인물로 연결합니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm font-semibold outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]">
            <option value="">불러올 캐릭터 선택</option>
            {existingCharacters.map((character) => (
              <option key={character.id} value={character.id} disabled={linkedExistingIds.has(character.id)}>
                {character.name}{linkedExistingIds.has(character.id) ? " (등록됨)" : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={addExisting} disabled={!selectedExisting || linkedExistingIds.has(selectedExisting.id)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f2937] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <Plus size={16} /> 불러오기
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#dfe3e8] bg-white p-4">
        <div className="mb-3">
          <h4 className="text-sm font-extrabold text-[#1f2937]">등장인물 추가</h4>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">이 스토리 안에서 바로 사용할 캐릭터를 이름, 성격, 말투 중심으로 등록합니다.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">이름 *</span>
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="예: 시칠" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">짧은 소개</span>
            <input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="역할이나 첫인상" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">성별</span>
            <input value={draft.gender} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="예: 여성, 남성, 비공개" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">나이</span>
            <input value={draft.age} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="예: 30세, 불명" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">성격 *</span>
            <textarea value={draft.personality} onChange={(event) => setDraft((current) => ({ ...current, personality: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="겉으로 보이는 성격, 숨기는 면, 행동 기준" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">말투 *</span>
            <textarea value={draft.speechStyle} onChange={(event) => setDraft((current) => ({ ...current, speechStyle: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="호칭, 문장 길이, 자주 쓰는 표현" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">메모</span>
            <textarea value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" placeholder="이 스토리에서의 역할, 관계, 주의할 설정" />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={addNew} disabled={!draft.name.trim() || !draft.personality.trim() || !draft.speechStyle.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a3e635] px-4 text-sm font-extrabold text-[#1a2e05] disabled:cursor-not-allowed disabled:opacity-40">
            <Plus size={16} /> 등장인물 추가
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-[#1f2937]">등록된 기본 등장인물</h4>
          <span className="text-xs font-semibold text-[#6b7280]">{characters.length}명</span>
        </div>
        {characters.length ? (
          <div className="grid gap-2">
            {characters.map((character) => {
              const isEditing = editingId === character.id;
              return (
              <div key={character.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">이름 *</span>
                        <input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">짧은 소개</span>
                        <input value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} className="h-10 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">성별</span>
                        <input value={editDraft.gender} onChange={(event) => setEditDraft((current) => ({ ...current, gender: event.target.value }))} className="h-10 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">나이</span>
                        <input value={editDraft.age} onChange={(event) => setEditDraft((current) => ({ ...current, age: event.target.value }))} className="h-10 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">성격 *</span>
                        <textarea value={editDraft.personality} onChange={(event) => setEditDraft((current) => ({ ...current, personality: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">말투 *</span>
                        <textarea value={editDraft.speechStyle} onChange={(event) => setEditDraft((current) => ({ ...current, speechStyle: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-extrabold text-[#4b5563]">메모</span>
                        <textarea value={editDraft.memo} onChange={(event) => setEditDraft((current) => ({ ...current, memo: event.target.value }))} rows={3} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
                      </label>
                      <div className="flex justify-end gap-2 sm:col-span-2">
                        <button type="button" onClick={cancelEdit} className="h-9 rounded-lg border border-[#ececef] px-3 text-sm font-bold text-[#4b5563] hover:bg-[#f7f7f8]">
                          취소
                        </button>
                        <button type="button" onClick={saveEdit} disabled={!editDraft.name.trim() || !editDraft.personality.trim() || !editDraft.speechStyle.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#a3e635] px-3 text-sm font-extrabold text-[#1a2e05] disabled:cursor-not-allowed disabled:opacity-40">
                          <Check size={15} /> 저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[#1f2937]">{character.name}</b>
                        <span className="rounded-full bg-[#f7fee7] px-2 py-0.5 text-[11px] font-bold text-[#4d6b00]">{character.source === "existing" ? "불러옴" : "신규"}</span>
                      </div>
                      {character.description ? <p className="mt-1 text-xs leading-5 text-[#6b7280]">{character.description}</p> : null}
                      {[character.gender ?? "", character.age ?? ""].filter(Boolean).length ? <p className="mt-1 text-xs leading-5 text-[#6b7280]">{[character.gender ?? "", character.age ?? ""].filter(Boolean).join(" · ")}</p> : null}
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#4b5563]">{character.personality}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4b5563]">{character.speechStyle}</p>
                      {character.memo ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6b7280]">메모: {character.memo}</p> : null}
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isEditing ? (
                    <button type="button" onClick={() => startEdit(character)} className="grid size-8 place-items-center rounded-full border border-[#ececef] text-[#6b7280] hover:bg-[#f7f7f8]" aria-label={`${character.name} 수정`}>
                      <Pencil size={14} />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => removeCharacter(character.id)} className="grid size-8 place-items-center rounded-full border border-[#ececef] text-[#6b7280] hover:bg-[#f7f7f8]" aria-label={`${character.name} 삭제`}>
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#dfe3e8] bg-[#fbfbfb] p-5 text-center text-sm font-semibold text-[#6b7280]">아직 등록된 기본 등장인물이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function buildStoryCastPrompt({
  name,
  description,
  gender,
  age,
  personality,
  speechStyle,
  memo
}: {
  name: string;
  description: string;
  gender: string;
  age: string;
  personality: string;
  speechStyle: string;
  memo: string;
}) {
  return [
    `Character name: ${name}`,
    description ? `Description: ${description}` : "",
    gender ? `Gender: ${gender}` : "",
    age ? `Age: ${age}` : "",
    `Personality: ${personality}`,
    `Speech style: ${speechStyle}`,
    memo ? `Story memo: ${memo}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function SectionFooter({
  notice,
  saveError,
  visible,
  saving,
  previousSection,
  nextSection,
  onSave,
  onJump,
  onPublish
}: {
  notice: string;
  saveError: string;
  visible: boolean;
  saving: boolean;
  previousSection?: Section;
  nextSection?: Section;
  onSave: () => void;
  onJump: (sectionId: string) => void;
  onPublish: (visibility: Visibility) => Promise<void>;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-[#ececef] pt-4">
      {notice && visible ? <p className="text-sm font-semibold text-[#4d6b00]">{notice}</p> : null}
      {saveError && visible ? <p className="text-sm font-semibold text-red-600">{saveError}</p> : null}
      <div className="flex flex-wrap justify-between gap-2">
        {previousSection ? (
          <a href={`#creator-section-${previousSection.id}`} onClick={(event) => { event.preventDefault(); onJump(previousSection.id); }} className="inline-flex h-10 items-center rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold">
            이전
          </a>
        ) : <span />}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onSave} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold hover:bg-[#f7f7f8]">
            <Save size={16} /> 단계 저장
          </button>
          {nextSection ? (
            <a href={`#creator-section-${nextSection.id}`} onClick={(event) => { event.preventDefault(); onJump(nextSection.id); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1f2937] px-5 text-sm font-bold text-white hover:bg-[#111827]">
              다음 <ChevronDown size={16} className="-rotate-90" />
            </a>
          ) : (
            <>
              <button type="submit" name="visibility" value="private" disabled={saving} className="h-10 rounded-lg border border-[#ececef] bg-white px-4 text-sm font-semibold disabled:opacity-50">비공개 저장</button>
              <button type="submit" name="visibility" value="public" disabled={saving} className="h-10 rounded-lg bg-[#a3e635] px-5 text-sm font-extrabold text-[#1a2e05] disabled:opacity-50">{saving ? "저장 중..." : "게시"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldControl({ field, value, error, onChange }: { field: Field; value: string; error?: boolean; onChange: (value: string) => void }) {
  const inputClassName = `w-full rounded-xl border bg-white text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb] ${error ? "border-red-400 ring-2 ring-red-100" : "border-[#dfe3e8]"}`;
  if (field.type === "chips") {
    const selected = splitChipValue(value);
    const toggleChip = (option: string) => {
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
      onChange(next.join(", "));
    };

    return (
      <div className="block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-extrabold text-[#1f2937]">{field.label}</span>
              {field.required ? <span className="font-bold text-[#65a30d]">*</span> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">{field.helper}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[#9ca3af]">{selected.length}개 선택</span>
        </div>
        <div className={`rounded-xl border bg-white p-3 ${error ? "border-red-400 ring-2 ring-red-100" : "border-[#dfe3e8]"}`}>
          <input id={field.name} name={field.name} type="hidden" value={value} />
          <div className="space-y-4">
            {field.chipGroups?.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-xs font-extrabold text-[#4b5563]">{group.title}</div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = selected.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleChip(option)}
                        className={`h-9 rounded-full border px-3 text-sm font-bold transition ${
                          active
                            ? "border-[#84cc16] bg-[#ecfccb] text-[#365314]"
                            : "border-[#dfe3e8] bg-white text-[#1f2937] hover:border-[#a3e635] hover:bg-[#f7fee7]"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        {error ? <p className="mt-2 text-xs font-semibold text-red-600">필수 항목입니다. 등록하려면 내용을 입력해 주세요.</p> : null}
      </div>
    );
  }

  return (
    <label htmlFor={field.name} className="block">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-extrabold text-[#1f2937]">{field.label}</span>
            {field.required ? <span className="font-bold text-[#65a30d]">*</span> : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">{field.helper}</p>
        </div>
        {field.maxLength ? <span className="shrink-0 text-xs font-semibold tabular-nums text-[#9ca3af]">{value.length} / {field.maxLength}</span> : null}
      </div>
      {field.type === "select" ? (
        <select id={field.name} name={field.name} value={value} required={field.required} onChange={(event) => onChange(event.target.value)} className={`h-11 px-3 font-semibold ${inputClassName}`}>
          <option value="">선택 안 함</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === "input" ? (
        <input id={field.name} name={field.name} value={value} required={field.required} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)} className={`h-11 px-3 ${inputClassName}`} placeholder={field.placeholder} />
      ) : (
        <textarea id={field.name} name={field.name} value={value} required={field.required} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)} className={`resize-y p-3 leading-6 ${inputClassName}`} placeholder={field.placeholder} rows={field.rows ?? 4} />
      )}
      {error ? <p className="mt-2 text-xs font-semibold text-red-600">필수 항목입니다. 등록하려면 내용을 입력해 주세요.</p> : null}
    </label>
  );
}

function splitChipValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function PreviewCard({ type, preview }: { type: CreatorType; preview: ReturnType<typeof buildPreview> }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="relative aspect-[3/4] bg-[#e7e8ea]">
        <img src={preview.image} alt="" className="size-full object-cover" />
        <span className="absolute left-3 top-3 rounded-md bg-[#a3e635] px-2 py-1 text-[10px] font-extrabold text-[#1a2e05]">{type === "story" ? "STORY" : "CHARACTER"}</span>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="font-story text-xl font-bold leading-snug">{preview.title}</h3>
        <p className="line-clamp-3 text-sm leading-6 text-[#6b7280]">{preview.description}</p>
        {type === "story" ? (
          <div className="flex flex-wrap gap-1">
            {preview.tags.map((tag) => <span key={tag} className="rounded-full bg-[#ecfccb] px-2 py-1 text-xs font-semibold text-[#4d6b00]">#{tag}</span>)}
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
      tags: [...splitChipValue(draft.category || ""), ...splitChipValue(draft.tags || "")]
        .filter(Boolean)
        .slice(0, 4)
        .concat(!draft.category && !draft.tags ? ["미리보기"] : []),
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
  return "대표 이미지를 선택해 주세요.";
}
