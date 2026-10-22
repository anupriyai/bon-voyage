import type { Metadata } from "next";
import IntakeWizard from "@/components/IntakeWizard";

export const metadata: Metadata = {
  title: "Tell us about the situation — Bon Voyage",
};

export default function StartPage() {
  return <IntakeWizard />;
}
