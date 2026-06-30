import { WorkspaceLayout } from "@/components/app-shell";
import { WorldForm } from "@/components/world-form";

export default function CreateWorldPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">World Studio</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">세계관 만들기</h1>
          <p className="mt-2 text-[#6b7280]">스토리보다 먼저 세계관을 만들고, 그 안에서 사용할 캐릭터를 관리합니다.</p>
        </div>
        <WorldForm />
      </section>
    </WorkspaceLayout>
  );
}
