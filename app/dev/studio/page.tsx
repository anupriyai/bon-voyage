import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/domains/account/auth";
import { user } from "@/domains/account/db";
import { getDb } from "@/shared/lib/db";
import StudioPage from "@/tooling/studio/StudioPage";

export const metadata = { title: "Developer QA studio — Bon Voyage", robots: { index: false, follow: false } };
export default async function Page() {
  if (process.env.DEV_STUDIO_ENABLED !== "true" || (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const [owner] = await getDb().select({ role: user.role }).from(user).where(eq(user.id, session.user.id));
  if (owner?.role !== "developer") notFound();
  return <StudioPage />;
}
