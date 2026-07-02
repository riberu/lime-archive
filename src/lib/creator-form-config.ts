export type Field = {
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

export type Section = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  required?: boolean;
  fields: Field[];
};

export const storySections: Section[] = [
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
    id: "characters",
    title: "캐릭터 설정",
    shortTitle: "캐릭터",
    description: "스토리에 기본 등장인물로 연결할 캐릭터를 불러오거나 새로 등록합니다.",
    fields: []
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

export const characterSections: Section[] = [
  {
    id: "profile",
    title: "캐릭터 설정",
    shortTitle: "설정",
    required: true,
    description: "캐릭터가 어떻게 보이고 소개될지 정합니다.",
    fields: [
      { name: "name", label: "캐릭터 이름", helper: "2~30자 권장", type: "input", placeholder: "예: 리치코", maxLength: 30, required: true },
      { name: "description", label: "한 줄 소개", helper: "30~120자 권장", type: "textarea", placeholder: "어떤 캐릭터인지 한눈에 보이는 소개를 적어주세요.", rows: 3, maxLength: 120, required: true },
      { name: "gender", label: "성별", helper: "필요한 경우 캐릭터의 성별 설정을 적어주세요.", type: "input", placeholder: "예: 여성, 남성, 무성, 비공개", maxLength: 30 },
      { name: "age", label: "나이", helper: "정확한 나이나 연령대를 적을 수 있습니다.", type: "input", placeholder: "예: 30세, 20대 후반, 불명", maxLength: 30 },
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
