import { WorkspaceLayout } from "@/components/app-shell";
import { CreatorLongForm } from "@/components/creator-long-form";

export default function CreateStoryPage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold text-[#4d6b00]">Long Form Creator</p>
          <h1 className="mt-2 font-story text-3xl font-extrabold">스토리 만들기</h1>
          <p className="mt-2 text-[#6b7280]">파트별 임시저장, 실시간 미리보기, 이미지 업로드를 지원합니다.</p>
        </div>
        <CreatorLongForm type="story" />
      </section>
    </WorkspaceLayout>
  );
}
