export type UserPersona = {
  id: string;
  name: string;
  appearance: string;
  speechStyle: string;
  memo: string;
  isDefault?: boolean;
};

const storageKey = "lime-user-personas";
const selectedKey = "lime-selected-persona";

export function createBlankPersona(): UserPersona {
  return {
    id: crypto.randomUUID(),
    name: "",
    appearance: "",
    speechStyle: "",
    memo: "",
    isDefault: false
  };
}

export function getDefaultPersonas(): UserPersona[] {
  return [
    {
      id: "default-persona",
      name: "리화",
      appearance: "검은 머리와 차분한 눈빛을 가진 미등록 용인. 겉으로는 침착하지만 낯선 상황을 빠르게 관찰한다.",
      speechStyle: "짧고 조심스럽게 말한다. 감정을 크게 드러내기보다 필요한 말만 먼저 꺼낸다.",
      memo: "리화는 혈통, 계열, 능력이 아직 공식 등록되지 않은 용인이다. 리화의 대사와 행동은 플레이어가 직접 입력한 것만 반영한다.",
      isDefault: true
    }
  ];
}

export function isPersonaConfigured(persona?: UserPersona) {
  if (!persona) return false;
  const name = persona.name.trim();
  if (!name || name === "기본 페르소나" || name === "주인공") return false;
  return Boolean(persona.appearance.trim() || persona.speechStyle.trim() || persona.memo.trim());
}

export function loadPersonas() {
  if (typeof window === "undefined") return getDefaultPersonas();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as UserPersona[];
    if (!parsed.length) return getDefaultPersonas();
    const defaultPersona = getDefaultPersonas()[0];
    return parsed.map((persona) => {
      const hasOldDemoPersona =
        persona.id === "default-persona" && (persona.memo.includes("베르디") || persona.appearance.includes("몰락 귀족"));
      if (persona.id === "default-persona" && (!isPersonaConfigured(persona) || hasOldDemoPersona)) return defaultPersona;
      return persona;
    });
  } catch {
    return getDefaultPersonas();
  }
}

export function savePersonas(personas: UserPersona[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(personas));
}

export function loadSelectedPersonaId(sessionId?: string) {
  if (typeof window === "undefined") return "default-persona";
  return window.localStorage.getItem(sessionId ? `${selectedKey}-${sessionId}` : selectedKey) ?? "default-persona";
}

export function saveSelectedPersonaId(personaId: string, sessionId?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionId ? `${selectedKey}-${sessionId}` : selectedKey, personaId);
  window.localStorage.setItem(selectedKey, personaId);
}

export function formatPersonaForPrompt(persona?: UserPersona) {
  if (!persona) return "";
  const lines = [
    "[현재 선택된 주인공 페르소나]",
    `이름: ${persona.name || "대표 페르소나"}`,
    `외모: ${persona.appearance || "미정"}`,
    `말투: ${persona.speechStyle || "미정"}`,
    `추가 메모: ${persona.memo || "없음"}`
  ];
  return lines.join("\n");
}
