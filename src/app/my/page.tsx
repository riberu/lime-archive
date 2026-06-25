import { WorkspaceLayout } from "@/components/app-shell";
import { MyWorksPageClient } from "@/components/my-works-page-client";

export const dynamic = "force-dynamic";

export default function MyWorksPage() {
  return (
    <WorkspaceLayout>
      <MyWorksPageClient />
    </WorkspaceLayout>
  );
}
