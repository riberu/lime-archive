"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Share2, Trash2 } from "lucide-react";

export type WorkItem = {
  id: string;
  type: "story" | "character";
  title: string;
  description: string;
  visibility: "public" | "private";
};

type Filter = "all" | "story" | "character" | "public" | "private";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "story", label: "스토리" },
  { value: "character", label: "캐릭터" },
  { value: "public", label: "공개" },
  { value: "private", label: "비공개" }
];

export function MyWorksManager({
  items,
  authToken,
  onDeleted
}: {
  items: WorkItem[];
  authToken?: string;
  onDeleted?: (items: WorkItem[]) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "all") return true;
      if (filter === "story" || filter === "character") return item.type === filter;
      return item.visibility === filter;
    });
  }, [filter, items]);

  const selectedVisibleIds = visibleItems.map((item) => itemKey(item));
  const allVisibleSelected = selectedVisibleIds.length > 0 && selectedVisibleIds.every((id) => selected.includes(id));

  const toggleAllVisible = () => {
    setSelected((current) => {
      if (allVisibleSelected) return current.filter((id) => !selectedVisibleIds.includes(id));
      return Array.from(new Set([...current, ...selectedVisibleIds]));
    });
  };

  const toggleOne = (item: WorkItem) => {
    const key = itemKey(item);
    setSelected((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
  };

  const deleteSelected = () => {
    const targets = items.filter((item) => selected.includes(itemKey(item)));
    if (!targets.length) return;
    if (!window.confirm(`${targets.length}개 작품을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    setError("");
    startTransition(async () => {
      const results = await Promise.all(
        targets.map(async (item) => {
          const response = await fetch(`/api/${item.type === "story" ? "stories" : "characters"}/${item.id}`, {
            method: "DELETE",
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
          });
          return { item, response };
        })
      );

      const failed = results.find(({ response }) => !response.ok);
      if (failed) {
        const payload = (await failed.response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "일부 작품을 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        return;
      }

      setSelected([]);
      onDeleted?.(targets);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="work-tabs">
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={filter === item.value ? "on" : ""}>
            {item.label}
          </button>
        ))}
        <button type="button" disabled={!selected.length || isPending} onClick={deleteSelected} className="danger-tab">
          <Trash2 size={14} /> 선택 삭제
        </button>
      </div>

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--ink-soft)]">
        <input id="select-all-works" name="select_all_works" type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="accent-[#a3e635]" />
        현재 목록 전체 선택
      </label>

      <div id="work-list">
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const key = itemKey(item);
            return (
              <article key={key} className="work">
                <input
                  id={`select-${key}`}
                  name="selected_works"
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => toggleOne(item)}
                  className="accent-[#a3e635]"
                  aria-label={`${item.title} 선택`}
                />
                <div className="cv ph" />
                <div className="wi">
                  <div className="t">{item.title}</div>
                  <div className="m">{item.description}</div>
                </div>
                <span className={`st ${item.visibility === "public" ? "pub" : "draft"}`}>{item.visibility === "public" ? "공개" : "비공개"}</span>
                <Link href={`/edit/${item.type}/${item.id}`} className="manage">
                  <Edit3 size={15} /> 수정
                </Link>
                <button type="button" className="manage" onClick={() => navigator.clipboard?.writeText(`${location.origin}/${item.type === "story" ? "stories" : "characters"}/${item.id}`)}>
                  <Share2 size={15} /> 공유
                </button>
              </article>
            );
          })
        ) : (
          <div className="empty-card">조건에 맞는 작품이 없어요.</div>
        )}
      </div>
    </div>
  );
}

function itemKey(item: WorkItem) {
  return `${item.type}:${item.id}`;
}
