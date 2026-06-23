import type { Character, ChatMessage, ChatSession, Story } from "@/lib/types";

export const demoStories: Story[] = [
  {
    id: "dragon-seoul",
    creatorId: "demo-user",
    title: "서울에 용이 너무 많아",
    description: "미래 서울에 숨어 사는 용과 이들을 관리하는 DMA의 사건 기록.",
    thumbnailUrl: "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80",
    systemPrompt:
      "너는 현대 판타지 롤플레잉 게임마스터다. 서울에는 용과 인간, 그리고 사건을 관리하는 DMA가 존재한다. NPC는 각자의 목적과 감정을 갖고 능동적으로 반응한다.",
    openingMessage:
      "[ #001 | DMA, VIP실 | 밤 9:40 ]\n\n유리벽 너머로 서울의 빌딩 숲이 푸르게 번졌다. 묵유는 문 앞에서 잠시 멈춰 서더니, 당신의 손목에 채워진 임시 등록 팔찌를 확인했다.\n\n\"긴장하지 않아도 됩니다. 다만 오늘 기록의 내용은 당신의 신분을 바꿀 수 있습니다.\"",
    currentScene: "2050년 7월 12일 밤, DMA VIP 기록실. 묵유가 유저를 보호하며 첫 등록 절차를 시작한다.",
    statusText: "#001 | 밤 9:40 | DMA VIP실 | 긴장 | 비",
    tags: ["현대판타지", "용", "DMA", "수사"],
    visibility: "public",
    likeCount: 128,
    chatCount: 853,
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "greenhouse-duke",
    creatorId: "demo-user",
    title: "온실의 대공님",
    description: "마력 식물이 자라는 온실에서 시작되는 계약과 권력, 그리고 아슬아슬한 로맨스.",
    thumbnailUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
    systemPrompt:
      "너는 로맨스 판타지 게임마스터다. 온실, 귀족 계약, 마력 식물, 왕궁 정치의 갈등을 중심으로 사건을 전개한다.",
    openingMessage:
      "온실의 유리 천장 위로 낯선 비가 떨어진다. 대공은 장갑을 벗으며 당신에게 고개를 돌렸다.\n\n\"계약서는 이미 준비했습니다. 이제 남은 건 당신의 대답뿐입니다.\"",
    currentScene: "마력 식물 온실. 대공과 유저가 비밀 계약을 앞두고 있다.",
    statusText: "#001 | 새벽 | 동쪽 온실 | 비밀 계약",
    tags: ["로맨스판타지", "귀족", "계약"],
    visibility: "public",
    likeCount: 72,
    chatCount: 319,
    createdAt: "2026-05-18T00:00:00.000Z"
  }
];

export const demoCharacters: Character[] = [
  {
    id: "mukyu",
    creatorId: "demo-user",
    storyId: "dragon-seoul",
    name: "묵유",
    description: "차갑고 예의 바르지만 보호 본능이 강한 DMA 요원.",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
    personality: "절제된 태도, 강한 책임감, 감정을 누르는 습관",
    speechStyle: "정중하고 낮은 말투. 감정이 격해져도 문장을 짧게 끊는다.",
    firstMessage: "긴장하지 않아도 됩니다. 다만 오늘 기록의 내용은 당신의 신분을 바꿀 수 있습니다.",
    prompt:
      "묵유는 DMA 요원이며 유저를 보호하려 한다. 세계관의 위험과 자신의 내적 갈등을 숨기지 않는다.",
    visibility: "public"
  },
  {
    id: "rihwa",
    creatorId: "demo-user",
    storyId: "dragon-seoul",
    name: "리화",
    description: "사건의 배후를 알고 있는 의문의 기록자.",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    personality: "다정하지만 쉽게 물러서지 않는 인물",
    speechStyle: "부드럽고 은유적인 말투",
    firstMessage: "당신이 그 이름을 말한 순간부터, 이미 기록은 움직이기 시작했어요.",
    prompt: "리화는 이야기에 따라 유저가 만날 수도, 통신 NPC가 될 수도 있다.",
    visibility: "public"
  }
];

export const demoSession: ChatSession = {
  id: "demo-session",
  storyId: "dragon-seoul",
  userId: "demo-user",
  title: "DMA VIP실에서",
  userNote:
    "나는 DMA 신규 등록자로, 겉으로는 침착하지만 용의 세계를 아직 두려워한다. AI는 내 선택을 존중하되 사건을 능동적으로 진행해 줘.",
  currentScene: "DMA VIP 기록실에서 첫 등록 절차가 진행 중이다.",
  memorySummary: "유저는 DMA 신규 등록자로, 묵유가 보호자처럼 동행하고 있다.",
  episodeState: { status: "opening", location: "DMA VIP실" },
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z"
};

export const demoMessages: ChatMessage[] = [
  {
    id: "m1",
    sessionId: "demo-session",
    role: "assistant",
    content: demoStories[0].openingMessage,
    createdAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "m2",
    sessionId: "demo-session",
    role: "user",
    content: "괜찮아요. 계속 진행해 주세요.",
    createdAt: "2026-06-23T00:01:00.000Z"
  }
];

export function findStory(id: string) {
  return demoStories.find((story) => story.id === id) ?? demoStories[0];
}
