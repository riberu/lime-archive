export type SuggestedReply = {
  text: string;
  kind: "combo";
};

export const outputLengthSteps = [1100, 1300, 1500, 1800, 2200, 2600];

export const fallbackSuggestions: SuggestedReply[] = [
  { text: "*문틈 너머의 기척을 조심스럽게 살핀다* 정말 관리청에서 나오신 건가요?", kind: "combo" },
  { text: "*곧장 대답하지 않고 상대의 태도를 먼저 확인한다* 저를 찾아온 이유부터 말해 주세요.", kind: "combo" },
  { text: "*상대가 내민 신분증으로 시선을 내린다* 이게 진짜라는 건 어떻게 믿죠?", kind: "combo" }
];
