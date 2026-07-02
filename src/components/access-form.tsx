"use client";

import { FormEvent, useState, useTransition } from "react";
import { LockKeyhole } from "lucide-react";

export function AccessForm({ nextPath }: { nextPath: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "입장 암호를 확인해 주세요.");
        return;
      }

      window.location.replace(nextPath || "/");
    });
  };

  return (
    <main className="access-page">
      <form className="access-card" onSubmit={submit}>
        <span className="access-mark">
          <LockKeyhole size={22} />
        </span>
        <p className="access-kicker">LIME TESTER ACCESS</p>
        <h1>테스터 입장</h1>
        <p>현재 사이트는 링크와 입장 암호를 가진 사람만 확인할 수 있어요.</p>
        <label htmlFor="site-access-password">입장 암호</label>
        <input
          id="site-access-password"
          name="site_access_password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="암호 입력"
          autoFocus
        />
        {error ? <span className="access-error">{error}</span> : null}
        <button type="submit" disabled={isPending || !password.trim()}>
          {isPending ? "확인 중..." : "입장하기"}
        </button>
      </form>
    </main>
  );
}
