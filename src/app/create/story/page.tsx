import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";

export default function CreateStoryPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-medium text-leaf-600">Long Form Creator</p>
          <h1 className="mt-2 text-3xl font-semibold">스토리 만들기</h1>
          <p className="mt-2 text-[#66705f]">긴 폼을 유지하되, 각 파트를 따로 저장하면서 계속 수정할 수 있게 구성했습니다.</p>
        </div>
        <CreatorLongForm type="story" />
      </section>
    </WorkspaceLayout>
  );
}
