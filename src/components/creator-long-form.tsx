"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Eye, FileText, ImagePlus, Loader2, RotateCcw, Save, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type CreatorType = "story" | "character";
type UploadState = "idle" | "uploading" | "uploaded" | "error";
type Visibility = "public" | "private";
type Draft = Record<string, string>;

type Field = {
  name: string;
  label: string;
  helper: string;
  type: "input" | "textarea" | "select" | "chips";
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  options?: string[];
  chipGroups?: Array<{ title: string; options: string[]; initiallyVisible?: number }>;
};

type Section = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  required?: boolean;
  fields: Field[];
};

const storySections: Section[] = [
  {
    id: "profile",
    title: "프로필",
    shortTitle: "프로필",
    required: true,
    description: "탐색 화면과 작품 상세에서 가장 먼저 보이는 기본 정보입니다.",
    fields: [
      { name: "title", label: "스토리 제목", helper: "2~40자 권장", type: "input", placeholder: "예: 밤의 기록 보관소", maxLength: 40, required: true },
      { name: "description", label: "한 줄 소개", helper: "카드에 보이는 짧은 소개입니다.", type: "textarea", placeholder: "어떤 분위기의 스토리인지 적어주세요.", rows: 3, maxLength: 120, required: true },
      {
        name: "category",
        label: "장르 / 배경",
        helper: "작품 탐색과 추천에 쓰일 큰 분류를 골라 주세요.",
        type: "chips",
        chipGroups: [
          { title: "장르 / 배경", options: ["BL", "시뮬레이션", "다인챗", "1:1", "로맨스", "로판", "판타지", "현대", "현대판타지", "무협", "미스터리", "아카데미", "액션", "일상", "SF"] }
        ]
      },
      {
        name: "tags",
        label: "소재 / 관계",
        helper: "스토리의 핵심 소재를 여러 개 선택할 수 있어요.",
        type: "chips",
        chipGroups: [
          { title: "소재 / 관계", options: ["빙의", "환생", "차원이동", "영혼체인지", "초능력", "인외존재", "역하렘", "하렘", "삼각관계", "동거", "계약관계", "정략결혼", "구원", "복수", "성장", "힐링", "피폐", "수사", "조직", "학교"] }
        ]
      }
    ]
  },
  {
    id: "story",
    title: "스토리 설정",
    shortTitle: "스토리 설정",
    required: true,
    description: "AI가 세계관과 등장인물을 유지하도록 핵심 설정을 정리합니다.",
    fields: [
      { name: "prompt_template", label: "프롬프트 템플릿", helper: "기본 진행 방식을 고릅니다.", type: "select", options: ["기본 롤플레잉", "게임마스터 중심", "캐릭터 대화 중심", "서사 묘사 중심"] },
      { name: "world", label: "세계관 / 설정 / 정보", helper: "세계관, 규칙, NPC, 금지사항을 길게 적어도 됩니다.", type: "textarea", placeholder: "시대, 장소, 세력, 주요 사건, 숨겨진 규칙, NPC 목록", rows: 8, maxLength: 5000, required: true },
      { name: "ai_rules", label: "AI 행동 규칙", helper: "답변 방식, 문체, 사건 전개 속도, 캐릭터 붕괴 방지 규칙입니다.", type: "textarea", placeholder: "유저가 짧게 말해도 장면을 이어가고 NPC가 능동적으로 반응하게 해 주세요.", rows: 7, maxLength: 3000 }
    ]
  },
  {
    id: "start",
    title: "시작 설정",
    shortTitle: "시작 설정",
    required: true,
    description: "채팅방을 열었을 때 유저가 처음 보게 되는 장면입니다.",
    fields: [
      { name: "opening_message", label: "오프닝 메시지", helper: "채팅방 첫 화면에 보이는 시작 문장입니다.", type: "textarea", placeholder: "비가 유리창을 두드리는 밤, 기록 보관소의 문이 스스로 열렸다.", rows: 5, maxLength: 1200, required: true },
      { name: "current_scene", label: "현재 상황", helper: "시간, 장소, 직전 사건, NPC의 위치를 적어주세요.", type: "textarea", placeholder: "밤 9시 40분, 지하 기록 보관소. 관리자는 사라졌고 낡은 열쇠만 남아 있다.", rows: 5, maxLength: 1200 },
      { name: "status_text", label: "상태창", helper: "채팅 상단이나 AI 기억에 붙일 짧은 상태값입니다.", type: "textarea", placeholder: "#001 | 밤 9:40 | 기록 보관소 | 긴장", rows: 3, maxLength: 500 }
    ]
  },
  {
    id: "style",
    title: "스타일 설정",
    shortTitle: "스타일",
    description: "문체와 진행 톤을 정합니다.",
    fields: [
      { name: "style_tone", label: "문체 / 분위기", helper: "묘사 밀도, 감정선, 대화 비율을 적어주세요.", type: "textarea", placeholder: "서늘하지만 과장되지 않게. 대사는 짧고 장면 묘사는 감각적으로.", rows: 5, maxLength: 1500 },
      { name: "forbidden_rules", label: "금지 규칙", helper: "원치 않는 전개나 표현을 명확히 적어주세요.", type: "textarea", placeholder: "유저의 행동을 대신 결정하지 않기. 결말을 성급히 확정하지 않기.", rows: 4, maxLength: 1200 }
    ]
  },
  {
    id: "media",
    title: "미디어",
    shortTitle: "미디어",
    description: "대표 이미지와 AI가 참고할 이미지 메모를 정리합니다.",
    fields: [
      { name: "media_notes", label: "이미지 / 배경 메모", helper: "업로드 이미지는 대표 이미지로 저장되고, 이 메모는 AI 참고 프롬프트에 합쳐집니다.", type: "textarea", placeholder: "좁고 높은 서가, 녹색 비상등, 오래된 종이 냄새.", rows: 5, maxLength: 1500 }
    ]
  },
  {
    id: "storyboard",
    title: "스토리보드",
    shortTitle: "스토리보드",
    description: "초반 전개 예시를 넣으면 AI가 더 자연스럽게 이어갑니다.",
    fields: [
      { name: "storyboard", label: "전개 예시", helper: "초반 사건 흐름을 적어주세요.", type: "textarea", placeholder: "1. 유저가 문을 열면 기록 카드가 떨어진다.\n2. NPC가 이름을 묻지만 자기 이름은 숨긴다.", rows: 8, maxLength: 2500 },
      { name: "example_dialogues", label: "대화 예시", helper: "캐릭터 말투를 고정하고 싶을 때 좋습니다.", type: "textarea", placeholder: "NPC: 이름을 말해요. 여긴 이름 없는 사람을 오래 두지 않거든요.", rows: 5, maxLength: 1500 }
    ]
  },
  {
    id: "ending",
    title: "엔딩 설정",
    shortTitle: "엔딩",
    description: "결말 조건과 실패 조건을 정합니다.",
    fields: [
      { name: "ending_rules", label: "엔딩 규칙", helper: "멀티 엔딩, 히든 엔딩, 실패 조건 등을 적어주세요.", type: "textarea", placeholder: "단서 3개 이상을 모으면 결말 후보를 열어준다.", rows: 5, maxLength: 1500 }
    ]
  },
  {
    id: "publish",
    title: "등록",
    shortTitle: "등록",
    description: "최종 system_prompt와 공개 여부를 정합니다.",
    fields: [
      { name: "system_prompt", label: "최종 system_prompt", helper: "비워두면 위 입력값을 조립해 저장합니다.", type: "textarea", placeholder: "직접 작성하거나 비워두세요.", rows: 10, maxLength: 8000 },
      { name: "rating_note", label: "운영 메모", helper: "민감한 소재나 주의할 설정을 적어두는 내부 메모입니다.", type: "textarea", placeholder: "잔혹 묘사는 낮게, 심리적 긴장 위주.", rows: 3, maxLength: 800 }
    ]
  }
];

const characterSections: Section[] = [
  {
    id: "profile",
    title: "캐릭터 설정",
    shortTitle: "설정",
    required: true,
    description: "캐릭터가 어떻게 보이고 소개될지 정합니다.",
    fields: [
      { name: "name", label: "캐릭터 이름", helper: "2~30자 권장", type: "input", placeholder: "예: 리치코", maxLength: 30, required: true },
      { name: "description", label: "한 줄 소개", helper: "30~120자 권장", type: "textarea", placeholder: "어떤 캐릭터인지 한눈에 보이는 소개를 적어주세요.", rows: 3, maxLength: 120, required: true },
      {
        name: "character_tags",
        label: "캐릭터 특성",
        helper: "외형, 성격, 관계 키워드를 골라 캐릭터 프롬프트에 반영합니다.",
        type: "chips",
        chipGroups: [
          { title: "외형 / 정체성", options: ["외국인", "인외", "능력자", "귀족", "기사", "마법사", "학생", "선생님", "아이돌", "배우", "요원", "의사", "괴물", "용", "악마", "천사"] },
          { title: "성격", options: ["다정", "냉정", "츤데레", "쿨데레", "얀데레", "능글", "무심", "집착", "순정", "오만", "소심", "장난기", "까칠", "성실", "비밀 많음"] },
          { title: "관계", options: ["첫만남", "친구", "소꿉친구", "라이벌", "상관", "부하", "계약관계", "보호자", "보호대상", "동거", "금지된 관계", "오해", "구원", "배신"] }
        ]
      }
    ]
  },
  {
    id: "intro",
    title: "인트로",
    shortTitle: "인트로",
    required: true,
    description: "채팅방을 열었을 때 유저가 처음 보는 메시지입니다.",
    fields: [
      { name: "first_message", label: "첫 메시지", helper: "캐릭터의 말투와 상황을 동시에 보여주세요.", type: "textarea", placeholder: "문이 열리자 캐릭터가 고개를 들었다. “늦었네요. 그래도 와 줬으니 아직 기회는 있어요.”", rows: 6, maxLength: 1200, required: true },
      { name: "intro_scene", label: "첫 장면 배경", helper: "첫 메시지 뒤에 숨은 상황 메모입니다.", type: "textarea", placeholder: "비밀 서고, 새벽, 캐릭터는 유저가 가져온 열쇠를 이미 알고 있다.", rows: 4, maxLength: 1000 }
    ]
  },
  {
    id: "prompt",
    title: "프롬프트",
    shortTitle: "프롬프트",
    required: true,
    description: "AI가 캐릭터성을 유지하기 위한 핵심 지시문입니다.",
    fields: [
      { name: "prompt", label: "캐릭터 프롬프트", helper: "성격, 목적, 반응 원칙을 통합해서 적어주세요.", type: "textarea", placeholder: "이 캐릭터는 조심스럽지만 유저를 밀어내지 않는다. 질문에는 단서 하나를 섞어 답한다.", rows: 9, maxLength: 5000, required: true }
    ]
  },
  {
    id: "advanced",
    title: "고급 기능",
    shortTitle: "고급",
    description: "기억 우선순위와 응답 규칙을 정합니다.",
    fields: [
      { name: "memory_rules", label: "기억 우선순위", helper: "AI가 절대 잊지 말아야 할 정보를 적어주세요.", type: "textarea", placeholder: "유저를 오래전 약속의 당사자로 의심한다. 단, 바로 확신하지 않는다.", rows: 5, maxLength: 1500 },
      { name: "response_rules", label: "응답 규칙", helper: "짧은 답, 긴 묘사, 질문 빈도 같은 규칙입니다.", type: "textarea", placeholder: "매 답변마다 질문만 던지지 말고 행동이나 사건을 하나씩 진행한다.", rows: 5, maxLength: 1500 }
    ]
  },
  {
    id: "detail",
    title: "캐릭터 상세",
    shortTitle: "상세",
    description: "성격, 말투, 관계와 비밀을 정리합니다.",
    fields: [
      { name: "personality", label: "성격", helper: "겉으로 보이는 면과 숨겨진 면을 나눠 적어도 좋습니다.", type: "textarea", placeholder: "겉으로는 침착하고 예의 바르지만 중요한 단서 앞에서는 급해진다.", rows: 5, maxLength: 1500 },
      { name: "speech_style", label: "말투", helper: "호칭, 문장 길이, 자주 쓰는 표현입니다.", type: "textarea", placeholder: "짧고 단정한 문장. 유저를 '당신'이라고 부른다.", rows: 4, maxLength: 1000 },
      { name: "relationship", label: "관계와 비밀", helper: "유저와의 기본 관계, 감춰진 정보, 갈등을 적어주세요.", type: "textarea", placeholder: "처음 보는 척하지만 사실 오래전 기록에서 유저의 이름을 봤다.", rows: 5, maxLength: 1500 }
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
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [saving, setSaving] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

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

  const preview = useMemo(() => buildPreview(type, draft, imageUrl), [draft, imageUrl, type]);
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  const currentSection = sections[activeIndex] ?? sections[0];
  const previousSection = sections[activeIndex - 1];
  const nextSection = sections[activeIndex + 1];

  const persistDraft = (nextDraft = draft, nextImageUrl = imageUrl, nextSavedSections = savedSections) => {
    window.localStorage.setItem(storageKey, JSON.stringify({ draft: nextDraft, imageUrl: nextImageUrl, savedSections: nextSavedSections }));
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
      const endpoint = type === "story" ? "/api/stories" : "/api/characters";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ...draft, [imageField]: imageUrl, visibility })
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
                {currentSection.fields.map((field) => (
                  <FieldControl key={field.name} field={field} value={draft[field.name] ?? ""} error={missingFields.includes(field.name)} onChange={(value) => updateField(field.name, value)} />
                ))}
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
