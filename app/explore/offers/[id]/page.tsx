import { notFound } from "next/navigation";
import { findPublicOffer, findTreatment } from "@/domains/providers";
import OfferPage from "@/domains/providers/components/OfferPage";
import type { SearchValues } from "@/domains/providers/search";
import { publicMetadata } from "@/shared/lib/siteMetadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const offer = findPublicOffer(id); if (!offer) notFound();
  return publicMetadata(`${findTreatment(offer.treatmentId)?.name} in ${offer.city}`, "Review verified cancer care listing details and plan travel after clinical confirmation.", `/explore/offers/${id}`, true);
}
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchValues> }) {
  const { id } = await params; const offer = findPublicOffer(id); if (!offer) notFound();
  return <OfferPage offer={offer} values={await searchParams} />;
}
