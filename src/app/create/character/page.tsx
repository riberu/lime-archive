import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";

export default function CreateCharacterPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-medium text-leaf-600">Character Studio</p>
          <h1 className="mt-2 text-3xl font-semibold">캐릭터 만들기</h1>
          <p className="mt-2 text-[#66705f]">캐릭터 이미지, 소개, 성격, 말투, 프롬프트를 독립적으로 관리합니다.</p>
        </div>
        <CreatorLongForm type="character" />
      </section>
    </WorkspaceLayout>
  );
}
