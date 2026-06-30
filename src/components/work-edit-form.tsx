"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Character, Story } from "@/lib/types";

type Props =
  | {
      type: "story";
      item: Story;
    }
  | {
      type: "character";
      item: Character;
    };

export function WorkEditForm(props: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = (formData: FormData) => {
    setError("");
    const payload = Object.fromEntries(formData.entries());
    const endpoint =
      props.type === "story"
        ? `/api/stories/${props.item.id}`
        : `/api/characters/${props.item.id}`;

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const token = data.session?.access_token;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.");
        return;
      }

      router.push("/my");
      router.refresh();
    });
  };

  return (
    <form action={save} className="space-y-5">
      {props.type === "story" ? <StoryFields story={props.item} /> : <CharacterFields character={props.item} />}

      <div className="flex flex-col items-end gap-2">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-leaf-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save size={16} /> {isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

function StoryFields({ story }: { story: Story }) {
  return (
    <>
      <Panel title="기본 정보">
        <TextInput name="title" label="스토리 제목" defaultValue={story.title} />
        <TextArea name="description" label="소개" defaultValue={story.description} rows={4} />
        <TextInput name="tags" label="태그" defaultValue={story.tags.join(", ")} />
        <TextInput name="thumbnail_url" label="대표 이미지 URL" defaultValue={story.thumbnailUrl} />
        <VisibilitySelect defaultValue={story.visibility} />
      </Panel>
      <Panel title="시작 장면">
        <TextArea name="opening_message" label="오프닝 메시지" defaultValue={story.openingMessage} rows={5} />
        <TextArea name="current_scene" label="현재 상황" defaultValue={story.currentScene} rows={5} />
        <TextArea name="status_text" label="상태 정보" defaultValue={story.statusText} rows={3} />
      </Panel>
      <Panel title="시스템 프롬프트">
        <TextArea name="system_prompt" label="system_prompt" defaultValue={story.systemPrompt} rows={12} />
      </Panel>
    </>
  );
}

function CharacterFields({ character }: { character: Character }) {
  return (
    <>
      <Panel title="기본 정보">
        <TextInput name="name" label="캐릭터 이름" defaultValue={character.name} />
        <TextArea name="description" label="소개" defaultValue={character.description} rows={4} />
        <TextInput name="avatar_url" label="이미지 URL" defaultValue={character.avatarUrl} />
        <TextInput name="storyId" label="연결된 스토리 ID" defaultValue={character.storyId ?? ""} />
        <VisibilitySelect defaultValue={character.visibility} />
      </Panel>
      <Panel title="캐릭터 설정">
        <TextArea name="personality" label="성격" defaultValue={character.personality} rows={5} />
        <TextArea name="speech_style" label="말투" defaultValue={character.speechStyle} rows={5} />
        <TextArea name="first_message" label="첫 메시지" defaultValue={character.firstMessage} rows={5} />
      </Panel>
      <Panel title="프롬프트">
        <TextArea name="prompt" label="캐릭터 프롬프트" defaultValue={character.prompt} rows={12} />
      </Panel>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e0ead4] bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function TextInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <input id={name} name={name} defaultValue={defaultValue} className="h-11 w-full rounded-lg border border-[#dce8d1] px-3 outline-none focus:border-leaf-500" />
    </label>
  );
}

function TextArea({ name, label, defaultValue, rows }: { name: string; label: string; defaultValue: string; rows: number }) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <textarea id={name} name={name} defaultValue={defaultValue} rows={rows} className="w-full resize-y rounded-lg border border-[#dce8d1] p-3 leading-6 outline-none focus:border-leaf-500" />
    </label>
  );
}

function VisibilitySelect({ defaultValue }: { defaultValue: "public" | "private" }) {
  return (
    <label htmlFor="visibility" className="block">
      <span className="mb-2 block text-sm font-medium">공개 상태</span>
      <select id="visibility" name="visibility" defaultValue={defaultValue} className="h-11 w-full rounded-lg border border-[#dce8d1] bg-white px-3 outline-none focus:border-leaf-500">
        <option value="public">공개</option>
        <option value="private">비공개</option>
      </select>
    </label>
  );
}
