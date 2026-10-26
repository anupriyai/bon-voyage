// Sign-in by email magic link (Better Auth), stored in our Postgres through Drizzle.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb, type Actor } from "@/shared/lib/db/index";
import * as schema from "@/domains/account/db";

async function sendMagicLink({ url }: { email: string; url: string }) {
  if (process.env.NODE_ENV !== "production") {
    // Development has no email service: the link goes to the server console. The address is not logged.
    console.info(`\nSign-in link (dev only): ${url}\n`);
    return;
  }
  throw new Error("Email sending is not configured (add Resend before production sign-in)");
}

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  user: {
    additionalFields: {
      // Set by coordinators through withActor, never by the person signing up.
      role: { type: "string", defaultValue: "patient", input: false },
    },
  },
  plugins: [magicLink({ sendMagicLink, storeToken: "hashed" }), nextCookies()],
});

/** The signed-in user as an audit actor, or null when signed out. */
export async function actorFrom(headers: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers });
  return session ? { id: session.user.id, type: "user" } : null;
}
