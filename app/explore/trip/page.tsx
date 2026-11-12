import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublicOffer } from "@/domains/providers";
import TripPlanner from "@/domains/providers/components/TripPlanner";
import { SiteHeader, SiteFooter } from "@/domains/marketing/SiteChrome";

export const metadata: Metadata = { title: "Plan care + travel | Bon Voyage", description: "Bring a treatment, sample flights and a nearby stay into one clear medical travel plan.", robots: { index: false, follow: true } };
export default async function TripPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const get = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const offerId = get("offer");
  if (!offerId || !findPublicOffer(offerId)) notFound();
  return <><SiteHeader /><TripPlanner offerId={offerId} planId={get("plan")} resumeAnonymous={get("resume") === "1"} initialQuery={{ from: get("from"), out: get("out"), back: get("back"), travellers: get("travellers") }} /><SiteFooter /></>;
}
