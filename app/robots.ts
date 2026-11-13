import type { MetadataRoute } from "next";
import { canIndexPublicContent, siteOrigin } from "@/shared/lib/siteMetadata";
export default function robots(): MetadataRoute.Robots {
  return { rules: canIndexPublicContent() ? { userAgent: "*", allow: "/", disallow: ["/api/", "/case/", "/account", "/dev/", "/explore/trip"] } : { userAgent: "*", disallow: "/" }, sitemap: `${siteOrigin()}/sitemap.xml` };
}
