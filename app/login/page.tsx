"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FlowHeader from "@/components/FlowHeader";
import { resumePath, useCase } from "@/lib/store";

export default function LoginPage() {
  const { ready, session, login, loadSample } = useCase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notFound, setNotFound] = useState(false);

  const nextParam = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    // Only follow in-app paths.
    return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
  };

  useEffect(() => {
    if (ready && session) router.replace(nextParam() ?? "/account");
  }, [ready, session, router]);

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
    <>
      <FlowHeader exitLabel="Back to home" />
      <main className="wiz container auth">
        <div className="wiz-card auth-card">
          <h1 className="auth-title">Log in</h1>
          <p className="q-help">Enter the email you used on your request and we will open your saved cases.</p>
          <form onSubmit={submit} className="auth-form" noValidate>
            <label className="fld">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                placeholder="name@example.com"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotFound(false);
                }}
              />
            </label>
            {notFound && (
              <p className="form-error" role="alert">
                We couldn&apos;t find a saved request for that email on this device.{" "}
                <Link href="/start" className="inline-link">
                  Start a new request
                </Link>
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block auth-btn" disabled={!email.trim()}>
              Open my cases
            </button>
          </form>
          <p className="wiz-foot auth-fine">
            Prototype: sign-in is simulated and only finds requests saved in this browser. The live product emails a
            one-time sign-in link, with no password to remember.
          </p>
          <p className="wiz-foot">
            New here?{" "}
            <Link href="/start" className="inline-link">
              Start a care request
            </Link>{" "}
            — submitting it signs you in automatically.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                loadSample();
                router.push("/case/about");
              }}
            >
              Open a sample case
            </button>
          </p>
        </div>
      </main>
    </>
  );
}
