import DirectoryPage from "@/domains/providers/components/DirectoryPage";
import { publicMetadata } from "@/shared/lib/siteMetadata";
import { PUBLIC_OFFERS } from "@/domains/providers";
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) { return publicMetadata("Cancer care destinations", "Browse countries and territories. Verified cancer clinics will appear when available.", "/destinations", PUBLIC_OFFERS.length > 0 && !(await searchParams).q); }
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) { const q = (await searchParams).q; return <DirectoryPage kind="destinations" query={Array.isArray(q) ? q[0] : q} />; }
