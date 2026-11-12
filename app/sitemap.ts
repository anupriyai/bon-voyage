import type { MetadataRoute } from "next";
import { canIndexPublicContent, siteOrigin } from "@/shared/lib/siteMetadata";
import { COUNTRIES, PUBLIC_OFFERS, TREATMENTS } from "@/domains/providers";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!canIndexPublicContent()) return [];
  const paths = ["/", "/about", "/how-it-works"];
  if (PUBLIC_OFFERS.length) paths.push("/destinations", "/treatments");
  for (const country of COUNTRIES) if (PUBLIC_OFFERS.some((offer) => offer.countryCode === country.code)) paths.push(`/destinations/${country.slug}`);
  for (const treatment of TREATMENTS) if (PUBLIC_OFFERS.some((offer) => offer.treatmentId === treatment.id)) paths.push(`/treatments/${treatment.slug}`);
  for (const offer of PUBLIC_OFFERS) paths.push(`/explore/offers/${offer.id}`);
  return paths.map((path) => ({ url: new URL(path, siteOrigin()).href }));
}
