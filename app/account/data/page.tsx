import type { Metadata } from "next";
import DataPage from "@/domains/account/components/DataPage";
export const metadata: Metadata = { title: "My data — Bon Voyage", robots: { index: false, follow: false } };
export default function Page() { return <DataPage />; }
