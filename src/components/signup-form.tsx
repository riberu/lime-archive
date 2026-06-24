"use client";

import { useState, useTransition } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const signInWithGoogle = () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 공개 키가 설정되어 있지 않습니다.");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/profile`
        }
      });
      if (error) setMessage(error.message);
    });
  };

  const signUpWithEmail = () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 공개 키가 설정되어 있지 않습니다.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`
        }
      });

      setMessage(error ? error.message : "가입 확인 메일을 보냈습니다. 메일함을 확인해 주세요.");
    });
  };

  return (
    <div className="ui-panel-card p-5">
      <div className="space-y-3">
        <button
          type="button"
          disabled={isPending}
          onClick={signInWithGoogle}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#ececef] bg-white text-sm font-bold hover:bg-[#f7f7f8] disabled:opacity-50"
        >
          <ShieldCheck size={18} /> Google로 계속하기
        </button>
        <button
          type="button"
          disabled
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#ececef] bg-[#f7f7f8] text-sm font-bold text-[#9ca3af]"
          title="Supabase 기본 OAuth 목록에는 Naver가 없어 Custom OAuth/OIDC 설정이 필요합니다."
        >
          Naver 연동 예정
        </button>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-[#9ca3af]">
        <span className="h-px flex-1 bg-[#ececef]" />
        또는 앱 자체 계정
        <span className="h-px flex-1 bg-[#ececef]" />
      </div>

      <div className="space-y-3">
        <label htmlFor="signup-email" className="block">
          <span className="mb-2 block text-sm font-semibold">이메일</span>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#ececef] bg-[#f7f7f8] px-3 outline-none focus:border-[#a3e635]"
            placeholder="you@example.com"
          />
        </label>
        <label htmlFor="signup-password" className="block">
          <span className="mb-2 block text-sm font-semibold">비밀번호</span>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#ececef] bg-[#f7f7f8] px-3 outline-none focus:border-[#a3e635]"
            placeholder="8자 이상 권장"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !email || !password}
          onClick={signUpWithEmail}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#a3e635] text-sm font-extrabold text-[#1a2e05] hover:bg-[#bef264] disabled:opacity-50"
        >
          <Mail size={17} /> 이메일로 가입
        </button>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-[#ecfccb] px-4 py-3 text-sm font-semibold text-[#3f6212]">{message}</p> : null}
    </div>
  );
}
