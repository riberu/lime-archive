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

export function MyWorksManager({ items }: { items: WorkItem[] }) {
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
        targets.map((item) =>
          fetch(`/api/${item.type === "story" ? "stories" : "characters"}/${item.id}`, {
            method: "DELETE"
          })
        )
      );

      const failed = results.find((response) => !response.ok);
      if (failed) {
        setError("일부 작품을 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        return;
      }

      setSelected([]);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`ui-chip ${filter === item.value ? "ui-chip-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!selected.length || isPending}
          onClick={deleteSelected}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={16} /> 선택 삭제
        </button>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="ui-panel-card overflow-hidden">
        <div className="grid gap-3 border-b border-[#ececef] bg-[#f7f7f8] p-4 text-sm font-bold text-[#6b7280] md:grid-cols-[40px_100px_1fr_auto] md:items-center">
          <input
            id="select-all-works"
            name="select_all_works"
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            className="size-4 accent-[#a3e635]"
            aria-label="현재 목록 전체 선택"
          />
          <span>종류</span>
          <span>작품</span>
          <span className="hidden md:block">관리</span>
        </div>

        {visibleItems.length ? (
          visibleItems.map((item) => {
            const key = itemKey(item);
            return (
              <div key={key} className="grid gap-3 border-b border-[#ececef] p-4 last:border-b-0 md:grid-cols-[40px_100px_1fr_auto] md:items-center">
                <input
                  id={`select-${key}`}
                  name="selected_works"
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => toggleOne(item)}
                  className="size-4 accent-[#a3e635]"
                  aria-label={`${item.title} 선택`}
                />
                <span className="w-fit rounded-md bg-[#ecfccb] px-3 py-1 text-xs font-extrabold text-[#4d6b00]">
                  {item.type === "story" ? "스토리" : "캐릭터"}
                </span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-[#6b7280]">{item.description}</p>
                  <p className="mt-1 text-xs text-[#9ca3af]">{item.visibility === "public" ? "공개" : "비공개"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/edit/${item.type}/${item.id}`} className="ui-icon-btn border border-[#ececef]" title="수정">
                    <Edit3 size={16} />
                  </Link>
                  <button type="button" className="ui-icon-btn border border-[#ececef]" title="공유">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-sm text-[#6b7280]">조건에 맞는 작품이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function itemKey(item: WorkItem) {
  return `${item.type}:${item.id}`;
}
