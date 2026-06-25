import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lime Archive",
  description: "스토리 롤플레잉 AI 채팅 서비스"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="clean-extension-user-select"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const clean = (root = document) => {
                  root.querySelectorAll?.("[style]").forEach((el) => {
                    if (el.style?.userSelect === "auto") {
                      el.style.removeProperty("user-select");
                      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
                    }
                  });
                };
                clean();
                const observer = new MutationObserver((mutations) => {
                  for (const mutation of mutations) {
                    if (mutation.type === "attributes") clean(mutation.target.parentElement || document);
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === 1) clean(node);
                    });
                  }
                });
                observer.observe(document.documentElement, {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeFilter: ["style"]
                });
                window.addEventListener("load", () => observer.disconnect(), { once: true });
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
