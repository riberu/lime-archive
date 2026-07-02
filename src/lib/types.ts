export type Visibility = "public" | "private";
export type CharacterScope = "independent" | "world";
export type MessageRole = "user" | "assistant" | "system";
export type MemoryEntryType = "short" | "long" | "character" | "location";
export type CurrencyType = "paid" | "free" | "mixed";
export type CurrencyTransactionType = "purchase" | "spend" | "attendance" | "refund" | "admin_grant" | "adjustment";
export type PaymentProvider = "apple" | "google" | "toss";
export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled";
export type StoryStartMode = "free" | "scene";

export type StoryStartSetting = {
  id: string;
  mode: StoryStartMode;
  title: string;
  description: string;
  openingMessage: string;
  currentScene: string;
  statusText: string;
  guide: string;
  suggestedReplies: string[];
};

export type World = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  rules: string;
  imageUrl: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
};

export type Story = {
  id: string;
  creatorId: string;
  worldId?: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  systemPrompt: string;
  openingMessage: string;
  currentScene: string;
  statusText: string;
  startSettings: StoryStartSetting[];
  tags: string[];
  visibility: Visibility;
  likeCount: number;
  chatCount: number;
  createdAt: string;
};

export type Character = {
  id: string;
  creatorId: string;
  storyId?: string;
  worldId?: string;
  roleNote?: string;
  scope: CharacterScope;
  isEnabled: boolean;
  name: string;
  description: string;
  gender: string;
  age: string;
  avatarUrl: string;
  personality: string;
  speechStyle: string;
  firstMessage: string;
  prompt: string;
  visibility: Visibility;
};

export type ChatSession = {
  id: string;
  storyId: string;
  userId: string;
  title: string;
  userNote: string;
  currentScene: string;
  memorySummary: string;
  episodeState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type MemoryEntry = {
  id: string;
  sessionId: string;
  type: MemoryEntryType;
  episodeNo: number;
  subjectKey: string;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  createdAt: string;
  updatedAt: string;
};

export type Wallet = {
  userId: string;
  paidBalance: number;
  freeBalance: number;
  totalBalance: number;
};

export type CurrencyTransaction = {
  id: string;
  userId: string;
  currencyType: CurrencyType;
  transactionType: CurrencyTransactionType;
  amount: number;
  paidDelta: number;
  freeDelta: number;
  paidBalanceAfter: number;
  freeBalanceAfter: number;
  reason: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type PurchaseReceipt = {
  id: string;
  userId: string;
  provider: PaymentProvider;
  orderId: string;
  productId: string;
  amountKrw: number;
  paidCoinAmount: number;
  status: PurchaseStatus;
  createdAt: string;
  updatedAt: string;
};
