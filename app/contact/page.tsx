import type { Metadata } from "next";
import ContactPage from "@/domains/marketing/ContactPage";

export const metadata: Metadata = { title: "Help & contact — Bon Voyage" };
export default function Page() { return <ContactPage />; }
