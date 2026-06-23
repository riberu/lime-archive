import { WorkspaceLayout } from "@/components/app-shell";
import { ProfileCard } from "@/components/profile-card";

export default function ProfilePage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-4xl px-5 py-8">
        <ProfileCard />
      </section>
    </WorkspaceLayout>
  );
}
