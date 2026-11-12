"use client";
// Browser-safe public account API. Never import the server account index into client code.
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({ plugins: [magicLinkClient(), passkeyClient()] });
