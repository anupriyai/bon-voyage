import type { Metadata } from "next";
import ProfilePage from "@/domains/account/components/ProfilePage";
export const metadata: Metadata = { title: "Your profile — Bon Voyage", robots: { index: false, follow: false } };
export default function Page() { return <ProfilePage />; }
