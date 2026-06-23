import type { Story } from "@/lib/types";

export const genreItems = [
  { slug: "modern-fantasy", label: "현대판타지", keywords: ["현대판타지", "도시", "DMA", "어반", "urban"] },
  { slug: "romance", label: "로맨스", keywords: ["로맨스", "로판", "계약", "romance"] },
  { slug: "fantasy", label: "판타지", keywords: ["판타지", "마법", "dragon", "fantasy"] },
  { slug: "academy", label: "아카데미", keywords: ["아카데미", "학교", "academy"] },
  { slug: "action", label: "액션", keywords: ["액션", "전투", "추격", "action"] },
  { slug: "mystery", label: "미스터리", keywords: ["미스터리", "사건", "기록", "mystery"] },
  { slug: "daily", label: "일상", keywords: ["일상", "힐링", "daily"] }
] as const;

export type GenreSlug = (typeof genreItems)[number]["slug"];

export function getGenre(slug: string) {
  return genreItems.find((genre) => genre.slug === slug);
}

export function filterStoriesByGenre(stories: Story[], slug: string) {
  const genre = getGenre(slug);
  if (!genre) return [];

  const needles = genre.keywords.map((keyword) => keyword.toLowerCase());

  return stories.filter((story) => {
    const haystack = [story.title, story.description, story.systemPrompt, ...story.tags].join(" ").toLowerCase();
    return needles.some((keyword) => haystack.includes(keyword));
  });
}

export function getFeaturedStories(stories: Story[]) {
  return [...stories].sort((a, b) => b.likeCount + b.chatCount - (a.likeCount + a.chatCount));
}
