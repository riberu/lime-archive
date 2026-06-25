import { AppShell } from "@/components/app-shell";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <AppShell>
      <main className="flex min-h-[calc(100dvh-56px)] items-start justify-center px-5 py-10">
        <SignupForm />
      </main>
    </AppShell>
  );
}
