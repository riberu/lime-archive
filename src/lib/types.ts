export type Visibility = "public" | "private";
export type MessageRole = "user" | "assistant" | "system";

export type Story = {
  id: string;
  creatorId: string;
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
  name: string;
  description: string;
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
