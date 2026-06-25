export const geminiModels = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    grade: "기본",
    note: "균형형, 현재 기본 모델"
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    grade: "Preview",
    note: "상위 품질, 제한이 더 빡빡할 수 있음"
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    grade: "상급",
    note: "고품질, 비용과 한도 부담 큼"
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    grade: "경제형",
    note: "빠르고 저렴한 경량 모델"
  }
] as const;

export type GeminiModelId = (typeof geminiModels)[number]["id"];

export const defaultGeminiModelId: GeminiModelId = "gemini-2.5-flash";

export function resolveGeminiModelId(value?: string) {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const candidate = value?.trim() || envModel || defaultGeminiModelId;
  return geminiModels.some((model) => model.id === candidate) ? candidate : defaultGeminiModelId;
}

export function getGeminiModelLabel(id: string) {
  return geminiModels.find((model) => model.id === id)?.label ?? geminiModels[0].label;
}
