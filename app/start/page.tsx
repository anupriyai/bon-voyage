import type { Metadata } from "next";
import Intake from "@/domains/case/components/Intake";
import { headers } from "next/headers";
import Link from "next/link";
import { actorFrom } from "@/domains/account/auth";
import { getProfileStore } from "@/domains/account/profileStore";
import { SiteFooter, SiteHeader } from "@/domains/marketing";

export const metadata: Metadata = {
  title: "Your story — Bon Voyage",
};

export default async function StartPage() {
  if (process.env.NODE_ENV === "production") {
    const actor = await actorFrom(await headers());
    const allowed = actor && (await getProfileStore().eligibility(actor)).active;
    if (!allowed) return <div className="home"><SiteHeader /><main className="home-shell marketing-note" style={{ marginBlock: "clamp(80px, 12vw, 170px)" }}><p className="h-kicker">Cancer care planning</p><h1>Real patient intake is not open yet.</h1><p>Bon Voyage is reviewing regional privacy, clinical and operating requirements. Please do not enter personal medical information. You can browse cancer care topics and destinations without an account.</p><Link className="btn btn-primary" href="/explore">Explore cancer care</Link>{actor && <p><Link href="/account/profile">Review your account profile</Link></p>}</main><SiteFooter /></div>;
  }
  return <Intake />;
}
