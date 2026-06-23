import type { Character, ChatMessage, Story } from "@/lib/types";

const gmRule =
  "GM Rule: Even if the user replies with a short phrase, never stop the conversation. Based on the prior conversation and worldbuilding, continuously introduce new incidents, sensory details, consequences, NPC reactions, and clear hooks for the user to respond to.";

export function buildSystemInstruction(params: {
  story: Story;
  characters?: Character[];
  userNote?: string;
  currentScene?: string;
  memorySummary?: string;
  episodeState?: Record<string, unknown>;
}) {
  const characterBlock = params.characters?.length
    ? params.characters
        .map(
          (character) =>
            `- ${character.name}: ${character.description}\n  Personality: ${character.personality}\n  Speech style: ${character.speechStyle}\n  Character prompt: ${character.prompt}`
        )
        .join("\n")
    : "No fixed characters are attached. Create NPCs only when they fit the world and scene.";

  return [
    "# Story System Prompt",
    params.story.systemPrompt,
    "",
    "# Opening Message",
    params.story.openingMessage || "No opening message is set.",
    "",
    "# Current Scene",
    params.currentScene || params.story.currentScene || "No current scene is set.",
    "",
    "# Status",
    params.story.statusText || "No status text is set.",
    "",
    "# Memory Summary",
    params.memorySummary || "No long-term memory summary has been written yet.",
    "",
    "# Episode State",
    JSON.stringify(params.episodeState ?? {}, null, 2),
    "",
    "# Characters",
    characterBlock,
    "",
    "# User Note - Highest Priority",
    "The following user note is the highest-priority session instruction. It defines the user's role, appearance, preferences, boundaries, and details the AI must remember. If it conflicts with the story prompt, preserve safety and coherence, then prioritize the user note.",
    params.userNote?.trim() || "No user note has been written yet.",
    "",
    "# Roleplay Style",
    "Write as an immersive story game master. Keep continuity, remember concrete details from the chat history, and respond with scene action plus NPC dialogue. Do not summarize the whole plot unless the user asks. End with momentum, not a dead stop.",
    "",
    "# Hardcoded Game Master Rule",
    gmRule
  ].join("\n");
}

export function toGeminiContents(messages: ChatMessage[], nextUserMessage: string) {
  return [
    ...messages
      .filter((message) => message.role !== "system" && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
    {
      role: "user",
      parts: [{ text: nextUserMessage }]
    }
  ];
}
