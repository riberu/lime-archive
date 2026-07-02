import { WorkspaceLayout } from "@/components/app-shell";
import { WalletPage } from "@/components/wallet-page";

export default function WalletRoutePage() {
  return (
    <WorkspaceLayout>
      <section className="mx-auto max-w-5xl px-5 py-8">
        <WalletPage />
      </section>
    </WorkspaceLayout>
  );
}
