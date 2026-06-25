"use client";

import { useEffect, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function SignupForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (session?.access_token) return;
      clearLocalUserData();
      await fetch("/api/local-demo-data", { method: "DELETE" }).catch(() => undefined);
    })();
  }, []);

  const signInWithGoogle = () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 공개 키가 설정되어 있지 않아요.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/profile`,
          skipBrowserRedirect: true
        }
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.url) {
        setMessage("Google 로그인 URL을 받아오지 못했어요. Supabase Auth Provider 설정을 확인해 주세요.");
        return;
      }

      window.location.assign(data.url);
    });
  };

  const signInWithEmail = () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 공개 키가 설정되어 있지 않아요.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      window.location.href = "/profile";
    });
  };

  const signUpWithEmail = () => {
    if (password !== passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않아요.");
      return;
    }
    if (!agree) {
      setMessage("필수 약관에 동의해 주세요.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 공개 키가 설정되어 있지 않아요.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`,
          data: { display_name: displayName }
        }
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        window.location.href = "/profile";
        return;
      }

      setMessage("가입 확인 메일을 보냈어요. 메일함을 확인해 주세요.");
    });
  };

  const submit = () => {
    if (mode === "login") signInWithEmail();
    else signUpWithEmail();
  };

  return (
    <div className="signup-col">
      <h1 className="h">{mode === "login" ? "라임 로그인" : "라임 시작하기"}</h1>
      <div className="sub">계정으로 로그인하면 프로필, 페르소나, 채팅 기록이 계정별로 저장됩니다.</div>

      <div className="social">
        <button type="button" disabled={isPending} onClick={signInWithGoogle}>
          <span className="dot dot-google" /> Google로 계속하기
        </button>
        <button type="button" disabled title="Naver OAuth는 Supabase Auth Provider 설정 후 연결할 수 있어요.">
          <span className="dot dot-naver" /> Naver로 계속하기
        </button>
        <button type="button" disabled title="Apple 로그인은 추후 연결 예정입니다.">
          <span className="dot dot-apple" /> Apple로 계속하기
        </button>
      </div>

      <div className="divider">또는 이메일로</div>

      <div className="field">
        <label htmlFor="signup-email">이메일</label>
        <input id="signup-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="signup-password">비밀번호</label>
        <input id="signup-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" />
      </div>

      {mode === "signup" ? (
        <>
          <div className="field">
            <label htmlFor="signup-password-confirm">비밀번호 확인</label>
            <input id="signup-password-confirm" name="password_confirm" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="다시 입력" />
          </div>
          <div className="field">
            <label htmlFor="signup-display-name">닉네임</label>
            <input id="signup-display-name" name="display_name" type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="표시할 이름" />
          </div>

          <label className="agree">
            <input id="signup-agree" name="agree_terms" type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
            <span>
              <a>이용약관</a> 및 <a>개인정보 처리방침</a>에 동의합니다. (필수)
            </span>
          </label>
        </>
      ) : null}

      <button type="button" disabled={isPending || !email || !password || (mode === "signup" && !passwordConfirm)} onClick={submit} className="btn btn-primary">
        {isPending ? "처리 중..." : mode === "login" ? "로그인하기" : "가입하기"}
      </button>

      <div className="to-login">
        {mode === "login" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "회원가입" : "로그인"}
        </button>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-[#ecfccb] px-4 py-3 text-sm font-semibold text-[#3f6212]">{message}</p> : null}
    </div>
  );
}

function clearLocalUserData() {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (
      key === "lime-user-personas" ||
      key === "lime-user-key" ||
      key === "lime-selected-persona" ||
      key.startsWith("lime-selected-persona-")
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
