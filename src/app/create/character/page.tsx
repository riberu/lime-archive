import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";

export default function CreateCharacterPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Character Studio</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">캐릭터 만들기</h1>
          <p className="mt-2 text-[#6b7280]">이미지, 소개, 성격, 말투, 첫 메시지를 저장하고 미리볼 수 있습니다.</p>
        </div>
        <CreatorLongForm type="character" />
      </section>
    </WorkspaceLayout>
  );
}
