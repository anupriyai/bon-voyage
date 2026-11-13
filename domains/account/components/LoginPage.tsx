"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/domains/account/client";
import { AssistantIdentity } from "@/shared/ui/Assistant";
import { FlowBackdrop, SimpleBar, resumePath, useCase, safeReturnPath } from "@/domains/case";
import { Arrow, Sparkle } from "@/shared/ui/Icons";

export default function LoginPage() {
  const { ready, session, loadSample, state } = useCase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sample, setSample] = useState(false);
  const [careTrip, setCareTrip] = useState(false);
  useEffect(() => {
    setCareTrip(safeReturnPath(new URLSearchParams(window.location.search).get("next")).startsWith("/explore/trip"));
  }, []);
  useEffect(() => {
    if (sample && state.sample) router.push(resumePath(state));
    else if (ready && session && !sample) router.replace(safeReturnPath(new URLSearchParams(window.location.search).get("next")));
  }, [ready, session, router, sample, state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const result = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: safeReturnPath(new URLSearchParams(window.location.search).get("next")),
      });
      setStatus(result.error ? "error" : "sent");
    } catch { setStatus("error"); }
  }
  async function passkeySignIn() {
    setStatus("sending");
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) { setStatus("error"); return; }
      router.replace(safeReturnPath(new URLSearchParams(window.location.search).get("next")));
    } catch { setStatus("error"); }
  }
  return (
    <div className="flow">
      <FlowBackdrop /><SimpleBar />
      <main className="wrap flow-main" style={{ justifyContent: "center" }}>
        <section className="flow-section" style={{ maxWidth: 620 }}>
          <AssistantIdentity status="Ready when you are" />
          <h1 style={{ margin: 0, fontSize: "clamp(34px, 3.8vw, 50px)", lineHeight: 1.06 }}>{careTrip ? "Keep your care trip together." : "Your journey, saved."}</h1>
          <p style={{ fontSize: 18, color: "var(--muted)" }}>{careTrip ? "Sign in with a one-time link, then return to your trip to save it or record a sample care request. Signing in does not submit a request." : "Sign in with a one-time link to save your case and return on another device."}</p>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="label">Email
              <input className="field" type="email" autoComplete="email" required value={email} placeholder="name@example.com" onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }} />
            </label>
            {status === "sent" && <p role="status">If this address can receive a sign-in link, check its inbox.{process.env.NODE_ENV !== "production" && " Local development links are stored in the private .bon-voyage/sign-in-link.txt file."}</p>}
            {status === "error" && <p role="alert">We couldn’t prepare your sign-in link. Please try again.</p>}
            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={status === "sending" || !email.trim()}>{status === "sending" ? "Preparing link…" : "Send sign-in link"}<Arrow size={18} /></button>
              <button type="button" className="btn btn-outline" disabled={status === "sending"} onClick={() => void passkeySignIn()}>Sign in with a passkey</button>
              {!careTrip && <button type="button" className="btn btn-outline" onClick={() => { setSample(true); loadSample(); }}><Sparkle size={16} />Try a sample case</button>}
            </div>
          </form>
          <p style={{ marginTop: 24, fontSize: 14, color: "var(--muted)" }}>{careTrip ? <><Link href="/explore">Keep browsing treatments</Link>. Your temporary plan stays on this device.</> : <>New here? <Link href="/start">Tell us what’s happening</Link>. Your unfinished answers stay on this device until you sign in.</>}</p>
        </section>
      </main>
    </div>
  );
}
