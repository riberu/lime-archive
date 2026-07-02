import type { Story, StoryStartSetting } from "@/lib/types";

export const FREE_START_SETTING_ID = "free-start";

export const freeStartSetting: StoryStartSetting = {
  id: FREE_START_SETTING_ID,
  mode: "free",
  title: "자유시작",
  description: "AI 오프닝 없이 사용자의 첫 입력을 시작점으로 이야기를 엽니다.",
  openingMessage: "",
  currentScene: "",
  statusText: "#0 | 자유시작",
  guide: "첫 메시지에 대사, 행동, 상황을 자유롭게 입력하세요.",
  suggestedReplies: []
};

type LegacyStartFields = {
  openingMessage?: string;
  currentScene?: string;
  statusText?: string;
};

type RawStartSetting = Partial<StoryStartSetting> & {
  name?: string;
  opening_message?: string;
  current_scene?: string;
  status_text?: string;
  suggested_replies?: string[] | string;
};

export function normalizeStoryStartSettings(raw: unknown, legacy: LegacyStartFields = {}) {
  const sceneSettings = Array.isArray(raw)
    ? raw.map(normalizeRawStartSetting).filter((setting): setting is StoryStartSetting => Boolean(setting))
    : [];

  const withoutFreeStart = sceneSettings.filter((setting) => setting.id !== FREE_START_SETTING_ID && setting.mode !== "free");
  if (!withoutFreeStart.length && hasLegacyStart(legacy)) {
    withoutFreeStart.push({
      id: "default",
      mode: "scene",
      title: "기본 설정",
      description: "작가가 지정한 기본 시작 장면입니다.",
      openingMessage: legacy.openingMessage?.trim() ?? "",
      currentScene: legacy.currentScene?.trim() ?? "",
      statusText: legacy.statusText?.trim() ?? "",
      guide: "",
      suggestedReplies: []
    });
  }

  return [freeStartSetting, ...withoutFreeStart];
}

export function getStoryStartSetting(story: Story, startSettingId?: string) {
  const settings = normalizeStoryStartSettings(story.startSettings, {
    openingMessage: story.openingMessage,
    currentScene: story.currentScene,
    statusText: story.statusText
  });

  return settings.find((setting) => setting.id === startSettingId) ?? settings.find((setting) => setting.mode === "scene") ?? freeStartSetting;
}

export function serializeStartSettingsForDb(settings: StoryStartSetting[]) {
  return settings
    .filter((setting) => setting.mode !== "free" && setting.id !== FREE_START_SETTING_ID)
    .map((setting, index) => ({
      id: cleanId(setting.id) || `start-${index + 1}`,
      mode: "scene" as const,
      title: setting.title.trim() || `시작 설정 ${index + 1}`,
      description: setting.description.trim(),
      openingMessage: setting.openingMessage.trim(),
      currentScene: setting.currentScene.trim(),
      statusText: setting.statusText.trim(),
      guide: setting.guide.trim(),
      suggestedReplies: setting.suggestedReplies.map((reply) => reply.trim()).filter(Boolean).slice(0, 3)
    }));
}

function normalizeRawStartSetting(value: RawStartSetting) {
  if (!value || typeof value !== "object") return null;
  const id = cleanId(value.id) || cleanId(value.name) || "";
  const title = String(value.title ?? value.name ?? "").trim();
  const mode = value.mode === "free" ? "free" : "scene";
  if (mode === "free") return null;

  const setting: StoryStartSetting = {
    id: id || slugFromTitle(title) || makeId(),
    mode,
    title: title || "시작 설정",
    description: String(value.description ?? "").trim(),
    openingMessage: String(value.openingMessage ?? value.opening_message ?? "").trim(),
    currentScene: String(value.currentScene ?? value.current_scene ?? "").trim(),
    statusText: String(value.statusText ?? value.status_text ?? "").trim(),
    guide: String(value.guide ?? "").trim(),
    suggestedReplies: normalizeReplies(value.suggestedReplies ?? value.suggested_replies)
  };

  return setting;
}

function normalizeReplies(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((reply) => reply.trim()).filter(Boolean).slice(0, 3);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((reply) => reply.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
}

function hasLegacyStart(value: LegacyStartFields) {
  return Boolean(value.openingMessage?.trim() || value.currentScene?.trim() || value.statusText?.trim());
}

function cleanId(value?: string) {
  return (value ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function slugFromTitle(value: string) {
  return cleanId(value.toLowerCase());
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
