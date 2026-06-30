export type Visibility = "public" | "private";
export type CharacterScope = "independent" | "world";
export type MessageRole = "user" | "assistant" | "system";
export type MemoryEntryType = "short" | "long" | "character" | "location";

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
