import type { Metadata } from "next";
import Intake from "@/components/bv/Intake";

export const metadata: Metadata = {
  title: "Your story — Bon Voyage",
};

export default function StartPage() {
  return <Intake />;
}
