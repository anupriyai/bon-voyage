 import type { Metadata } from "next";
import localFont from "next/font/local";
import "./bv.css";
import { CurrencyProvider } from "@/shared/lib/currency";
import PageMotion from "@/shared/ui/PageMotion";
import { CaseProvider } from "@/domains/case/state/store";
import { siteOrigin } from "@/shared/lib/siteMetadata";

const matter = localFont({
  src: [
    { path: "../public/fonts/matterRegular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/matterMedium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/matterSemibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-matter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "Bon Voyage — Your care journey, connected",
  description:
    "Explore care abroad with an AI-guided plan shaped around you, from understanding your options to coordinating travel, with a named coordinator alongside.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={matter.variable}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        <CurrencyProvider>
          <CaseProvider><PageMotion />{children}</CaseProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
