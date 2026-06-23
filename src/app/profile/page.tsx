import { WorkspaceLayout } from "@/components/app-shell";

export default function ProfilePage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-4xl px-5 py-8">
        <div className="rounded-lg border border-[#e0ead4] bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-16 place-items-center rounded-full bg-leaf-100 text-xl font-semibold text-leaf-900">L</div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">리치코</h1>
              <p className="mt-2 text-sm text-[#66705f]">스토리와 캐릭터를 만드는 작가 프로필입니다.</p>
              <div className="mt-4 flex gap-4 text-sm text-[#526047]">
                <span>활동 배지 5</span>
                <span>팔로워 0</span>
                <span>팔로잉 0</span>
              </div>
            </div>
            <button className="h-9 rounded-md border border-[#dce8d1] px-4 text-sm">수정</button>
          </div>
        </div>
      </section>
    </WorkspaceLayout>
  );
}
