import { notFound } from "next/navigation";
import { COUNTRIES, PUBLIC_OFFERS } from "@/domains/providers";
import ExplorePage from "@/domains/providers/components/ExplorePage";
import type { SearchValues } from "@/domains/providers/search";
import { publicMetadata } from "@/shared/lib/siteMetadata";

export function generateStaticParams() { return COUNTRIES.map((country) => ({ country: country.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params; const country = COUNTRIES.find((item) => item.slug === slug); if (!country) notFound();
  return publicMetadata(`Cancer care in ${country.name}`, `Browse verified cancer clinic listings in ${country.name} when available.`, `/destinations/${country.slug}`, PUBLIC_OFFERS.some((offer) => offer.countryCode === country.code));
}
export default async function Page({ params, searchParams }: { params: Promise<{ country: string }>; searchParams: Promise<SearchValues> }) {
  const { country: slug } = await params; const country = COUNTRIES.find((item) => item.slug === slug); if (!country) notFound();
  return <ExplorePage heading={`Explore cancer care in ${country.name}.`} intro={`Verified clinic listings appear here when available. This country directory does not establish treatment, appointment or travel availability.`} values={{ ...await searchParams, country: country.code }} />;
}
