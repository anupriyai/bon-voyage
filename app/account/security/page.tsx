import type { Metadata } from "next";
import SecurityPage from "@/domains/account/components/SecurityPage";
export const metadata: Metadata = { title: "Login & security — Bon Voyage", robots: { index: false, follow: false } };
export default function Page() { return <SecurityPage />; }
