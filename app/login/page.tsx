"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssistantIdentity } from "@/components/bv/Assistant";
import { FlowBackdrop } from "@/components/bv/CaseShell";
import { SimpleBar } from "@/components/bv/SimpleBar";
import { Arrow, Sparkle } from "@/components/bv/icons";
import { resumePath, useCase } from "@/lib/store";

export default function LoginPage() {
  const { ready, session, login, loadSample, state } = useCase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [sample, setSample] = useState(false);

  const nextParam = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    // Only follow in-app paths.
    return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
  };

  useEffect(() => {
    if (sample && state.sample) router.push(resumePath(state));
    else if (ready && session && !sample) router.replace(nextParam() ?? "/account");
  }, [ready, session, router, sample, state]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = login(email);
    if (found.length === 0) {
      setNotFound(true);
      return;
    }
    // One saved case: go straight back into it. Several: pick from the list.
    router.push(nextParam() ?? (found.length === 1 ? resumePath(found[0]) : "/account"));
  };

  return (
    <div className="flow">
      <FlowBackdrop />
      <SimpleBar />
      <main className="wrap flow-main" style={{ justifyContent: "center" }}>
        <section className="flow-section" style={{ maxWidth: 620 }}>
          <AssistantIdentity status="Ready when you are" />
          <h1 className="bv-in" style={{ margin: 0, fontSize: "clamp(34px, 3.8vw, 50px)", lineHeight: 1.06, letterSpacing: "-0.03em", fontWeight: 800 }}>
            Welcome back.
          </h1>
          <p className="bv-in bv-d1" style={{ margin: "12px 0 0", fontSize: 18, color: "var(--muted)" }}>
            Enter the email you used for your case and I’ll pick up exactly where you left off.
          </p>
          <form onSubmit={submit} noValidate className="bv-in bv-d2" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="label">
              Email
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                placeholder="name@example.com"
                style={{ minHeight: 60, fontSize: 21 }}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotFound(false);
                }}
              />
            </label>
            {notFound && (
              <p role="alert" className="bv-swap" style={{ margin: 0, color: "var(--sand-soft)" }}>
                I couldn’t find a saved case for that email on this device. <Link href="/start">Start a new one</Link>.
              </p>
            )}
            <div className="actions" style={{ marginTop: 6 }}>
              <button type="submit" className="btn btn-primary bv-btn" aria-disabled={!email.trim()}>
                Open my journey
                <Arrow size={18} />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSample(true);
                  loadSample();
                }}
              >
                <Sparkle size={16} style={{ color: "var(--mint)" }} />
                Try a sample case
              </button>
            </div>
          </form>
          <p className="bv-in bv-d3" style={{ margin: "24px 0 0", fontSize: 14, color: "var(--muted)" }}>
            Prototype: sign-in is simulated and only finds cases saved in this browser. The live product emails a one-time sign-in link, with no
            password to remember. New here? <Link href="/start">Tell us what’s happening</Link> and your case is saved as you go.
          </p>
        </section>
      </main>
    </div>
  );
}
