import { AppShell } from "@/components/app-shell";
import { SignupForm } from "@/components/signup-form";

const memberPages = [
  ["내 정보", "닉네임, 프로필 이미지, 소개, 가입 연동 상태"],
  ["내 작품", "내가 만든 스토리/캐릭터 수정, 공개 상태, 삭제"],
  ["관심 목록", "좋아요한 스토리와 캐릭터를 따로 저장"],
  ["알림", "출석, 공지, 시스템 안내, 댓글/좋아요 알림"],
  ["채팅 보관함", "가입자별 채팅방, 유저 노트, 대화 기록"],
  ["설정", "알림 수신, 성인/민감 콘텐츠 설정, 계정 탈퇴"]
];

export default function SignupPage() {
  return (
    <AppShell>
      <main className="mx-auto grid min-h-[calc(100dvh-56px)] w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[420px_1fr]">
        <section>
          <p className="text-sm font-bold text-[#4d6b00]">Member Access</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">회원가입</h1>
          <p className="mt-3 leading-7 text-[#6b7280]">
            Google 또는 앱 자체 계정으로 가입할 수 있게 준비했습니다. Naver는 Supabase 기본 provider가 아니라 별도 OAuth 설정이 필요합니다.
          </p>
          <div className="mt-6">
            <SignupForm />
          </div>
        </section>

        <section className="ui-panel-card p-6">
          <h2 className="ui-shelf-title">가입자별로 관리되어야 할 페이지</h2>
          <p className="ui-shelf-sub mt-1">계정이 붙으면 아래 영역들이 사용자별 데이터로 분리되어야 합니다.</p>
          <div className="mt-6 grid gap-3">
            {memberPages.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-[#ececef] bg-[#f7f7f8] p-4">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#6b7280]">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
