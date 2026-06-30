"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { World } from "@/lib/types";

type Props = {
  world?: World;
};

export function WorldForm({ world }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = (formData: FormData) => {
    setError("");
    const payload = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.push("/signup");
        return;
      }

      const endpoint = world ? `/api/worlds/${world.id}` : "/api/worlds";
      const response = await fetch(endpoint, {
        method: world ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

      if (!response.ok || !data?.id) {
        setError(data?.error ?? "세계관을 저장하지 못했습니다.");
        return;
      }

      router.push(`/worlds/${data.id}`);
      router.refresh();
    });
  };

  return (
    <form action={save} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="space-y-4">
        <Field name="title" label="세계관 이름" defaultValue={world?.title ?? ""} required />
        <TextArea name="description" label="세계관 소개" defaultValue={world?.description ?? ""} rows={4} />
        <TextArea name="rules" label="세계관 규칙 / 용어 / 세력" defaultValue={world?.rules ?? ""} rows={10} />
        <Field name="image_url" label="세계관 이미지 URL" defaultValue={world?.imageUrl ?? ""} />
      </div>
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="mt-5 flex justify-end">
        <button type="submit" disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a3e635] px-5 text-sm font-extrabold text-[#1a2e05] disabled:opacity-50">
          <Save size={16} /> {isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

function Field({ name, label, defaultValue, required }: { name: string; label: string; defaultValue: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-[#1f2937]">{label}{required ? " *" : ""}</span>
      <input name={name} defaultValue={defaultValue} required={required} className="h-11 w-full rounded-xl border border-[#dfe3e8] px-3 text-sm outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
    </label>
  );
}

function TextArea({ name, label, defaultValue, rows }: { name: string; label: string; defaultValue: string; rows: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-[#1f2937]">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={rows} className="w-full resize-y rounded-xl border border-[#dfe3e8] p-3 text-sm leading-6 outline-none focus:border-[#a3e635] focus:ring-2 focus:ring-[#ecfccb]" />
    </label>
  );
}
