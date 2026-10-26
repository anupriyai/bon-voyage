import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./bv.css";
import { CurrencyProvider } from "@/shared/lib/currency";
import { CaseProvider } from "@/domains/case/state/store";

const source = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
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
    <html lang="en" data-scroll-behavior="smooth" className={source.variable}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        <CurrencyProvider>
          <CaseProvider>{children}</CaseProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
