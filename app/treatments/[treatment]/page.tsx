import { notFound } from "next/navigation";
import { TREATMENTS, findTreatment, PUBLIC_OFFERS } from "@/domains/providers";
import ExplorePage from "@/domains/providers/components/ExplorePage";
import type { SearchValues } from "@/domains/providers/search";
import { publicMetadata } from "@/shared/lib/siteMetadata";

export function generateStaticParams() { return TREATMENTS.map((treatment) => ({ treatment: treatment.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ treatment: string }> }) {
  const { treatment: slug } = await params; const treatment = findTreatment(slug); if (!treatment) notFound();
  return publicMetadata(`${treatment.name} abroad`, treatment.summary, `/treatments/${treatment.slug}`, PUBLIC_OFFERS.some((offer) => offer.treatmentId === treatment.id));
}
export default async function Page({ params, searchParams }: { params: Promise<{ treatment: string }>; searchParams: Promise<SearchValues> }) {
  const { treatment: slug } = await params; const treatment = findTreatment(slug); if (!treatment) notFound();
  return <ExplorePage heading={`${treatment.name}, across destinations.`} intro={treatment.summary} values={{ ...await searchParams, treatment: treatment.id }} />;
}
