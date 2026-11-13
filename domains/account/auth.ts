// Sign-in by email magic link (Better Auth), stored in our Postgres through Drizzle.
import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { consumeRequestLimit } from "@/shared/lib/db/requestLimit";
import { sendEmail } from "@/shared/lib/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { passkey } from "@better-auth/passkey";
import { getDb, type Actor } from "@/shared/lib/db/index";
import { HttpError } from "@/shared/lib/http";
import * as schema from "@/domains/account/db";

async function deliverAuthLink({ email, url, subject }: { email: string; url: string; subject: string }) {
  if (process.env.NODE_ENV !== "production") {
    // Local-only inbox, overwritten each time; links never enter ordinary server logs.
    const path = resolve(process.env.DEV_MAGIC_LINK_CAPTURE_FILE || ".bon-voyage/sign-in-link.txt");
    await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, url + "\n", { mode: 0o600 });
    return;
  }
  await sendEmail({ to: email, subject, text: `Open this one-time Bon Voyage verification link: ${url}`, key: `auth-link/${createHash("sha256").update(url).digest("hex")}` });
}

export const auth = betterAuth({
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  session: { expiresIn: 12 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true, window: 60, max: 60,
    customRules: { "/sign-in/magic-link": { window: 60, max: 3 }, "/passkey/*": { window: 60, max: 12 } },
    customStorage: { consume: (key, rule) => {
      const secret = process.env.BETTER_AUTH_SECRET;
      if (!secret) throw new Error("auth_not_configured");
      const hash = createHmac("sha256", secret).update("auth-limit:" + key).digest("hex");
      return consumeRequestLimit(getDb(), hash, rule);
    } },
  },
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  user: {
    changeEmail: { enabled: true, updateEmailWithoutVerification: false },
    additionalFields: {
      // Set by coordinators through withActor, never by the person signing up.
      role: { type: "string", defaultValue: "patient", input: false },
    },
  },
  emailVerification: { expiresIn: 300, sendVerificationEmail: async ({ user, url }) => deliverAuthLink({ email: user.email, url, subject: "Verify your Bon Voyage email address" }) },
  plugins: [magicLink({ sendMagicLink: ({ email, url }) => deliverAuthLink({ email, url, subject: "Sign in to Bon Voyage" }), storeToken: "hashed", expiresIn: 300 }), passkey({ authenticatorSelection: { userVerification: "required" } }), nextCookies()],
});

/** The signed-in user as an audit actor, or null when signed out. */
export async function actorFrom(headers: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers });
  return session ? { id: session.user.id, type: "user" } : null;
}

/** Sensitive actions require a new email-link or passkey login, not merely an old cookie. */
export async function recentActorFrom(headers: Headers): Promise<Actor> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new HttpError(401, "unauthorized");
  const created = new Date(session.session.createdAt).getTime();
  if (!Number.isFinite(created) || Date.now() - created > 10 * 60_000 || created > Date.now() + 30_000) throw new HttpError(403, "verification_required");
  return { id: session.user.id, type: "user" };
}
