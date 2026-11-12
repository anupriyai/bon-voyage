import DirectoryPage from "@/domains/providers/components/DirectoryPage";
import { publicMetadata } from "@/shared/lib/siteMetadata";
import { PUBLIC_OFFERS } from "@/domains/providers";
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) { return publicMetadata("Cancer care topics", "Browse cancer care consultations and treatment approaches. A specialist must confirm individual options.", "/treatments", PUBLIC_OFFERS.length > 0 && !(await searchParams).q); }
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) { const q = (await searchParams).q; return <DirectoryPage kind="treatments" query={Array.isArray(q) ? q[0] : q} />; }
