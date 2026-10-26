import type { Metadata } from "next";
import Intake from "@/domains/case/components/Intake";

export const metadata: Metadata = {
  title: "Your story — Bon Voyage",
};

export default function StartPage() {
  return <Intake />;
}
