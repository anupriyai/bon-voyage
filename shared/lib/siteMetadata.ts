import type { Metadata } from "next";

function configuredSite() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}
export const siteOrigin = () => configuredSite()?.origin ?? "http://localhost:3000";
export function canIndexPublicContent() {
  const url = configuredSite();
  return process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_SITE_URL) && !!url && url.protocol === "https:" && url.hostname.includes(".") && !/^(localhost|127\.|0\.|\[::1\])/i.test(url.hostname) && !/\.(localhost|local)$/i.test(url.hostname);
}
export function publicMetadata(title: string, description: string, path: string, substantive = false): Metadata {
  return { title: `${title} — Bon Voyage`, description, alternates: { canonical: new URL(path, siteOrigin()).href }, robots: { index: substantive && canIndexPublicContent(), follow: true } };
}
