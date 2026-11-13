import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/domains/account/index";
import { recentActorFrom } from "@/domains/account/auth";
import { privateJson } from "@/shared/lib/http";

const handlers = toNextJsHandler(auth);
const freshChanges = new Set(["change-email", "passkey/generate-register-options", "passkey/verify-registration", "passkey/delete-passkey", "passkey/update-passkey"]);
export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (path === "passkey/generate-register-options") {
    try { await recentActorFrom(request.headers); }
    catch { return privateJson({ error: "verification_required" }, 403); }
  }
  return handlers.GET(request);
}
export async function POST(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (freshChanges.has(path)) {
    try { await recentActorFrom(request.headers); }
    catch { return privateJson({ error: "verification_required" }, 403); }
  }
  return handlers.POST(request);
}
