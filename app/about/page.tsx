import type { Metadata } from "next";
import AboutPage from "@/domains/marketing/AboutPage";

export const metadata: Metadata = { title: "About us — Bon Voyage" };
export default function Page() { return <AboutPage />; }
