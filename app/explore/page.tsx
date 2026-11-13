import type { Metadata } from "next";
import ExplorePage from "@/domains/providers/components/ExplorePage";
import type { SearchValues } from "@/domains/providers/search";
import { publicMetadata } from "@/shared/lib/siteMetadata";

export const metadata: Metadata = publicMetadata("Explore cancer care", "Browse cancer care topics and destinations. Clinic listings appear only after verification.", "/explore");
export default async function Page({ searchParams }: { searchParams: Promise<SearchValues> }) { return <ExplorePage values={await searchParams} />; }
