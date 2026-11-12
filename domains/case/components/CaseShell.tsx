"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCase } from "@/domains/case/state/store";
import JourneyBar, { PHASES } from "@/domains/case/components/JourneyBar";

export function FlowBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="flow-glow-a bv-float" />
      <div aria-hidden="true" className="flow-glow-b bv-float" />
    </>
  );
}

/** Wraps every case step: privacy check, backdrop and the journey bar. */
export default function CaseShell({ children }: { children: ReactNode }) {
  const { state, ready, hasActive, session, saveStatus, saveNow, reloadCases } = useCase();
  const path = usePathname();
  const router = useRouter();
  const allowed = ready && hasActive && state.complete && (!!session || state.sample);

  // Cases are private to the signed-in email: send everyone else to log in, or to their list of cases.
  useEffect(() => {
    if (!ready) return;
    if (!session && !state.sample) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!allowed) router.replace("/account");
  }, [ready, session, state.sample, allowed, path, router]);

  const active = Math.max(1, PHASES.findIndex((p) => p.href === (path === "/case/booking" ? "/case/flights" : path)));

  return (
    <div className="flow">
      <FlowBackdrop />
      <JourneyBar active={active} />
      {allowed && !state.sample && (saveStatus === "error" || saveStatus === "conflict") && (
        <div className="wrap" role="alert" style={{ position: "relative", paddingTop: 20 }}>
          <p>{saveStatus === "conflict" ? "This case changed on another device. Reload the saved copy before continuing." : "We couldn’t save to your account. Your working copy is on this device."}</p>
          {saveStatus === "error" && <button type="button" className="btn btn-outline btn-sm" onClick={() => { void saveNow().catch(() => {}); }}>Retry saving</button>}
          <button type="button" className="link-btn" onClick={() => { if (window.confirm("Reload saved cases? Unsaved changes on this device will be replaced.")) reloadCases(); }}>Reload saved cases</button>
        </div>
      )}
      {allowed ? (
        children
      ) : (
        <main className="wrap flow-main" aria-busy="true">
          <div className="flow-section">
            <span className="bv-shimmer" style={{ height: 52, width: 260, borderRadius: 999 }} />
            <span className="bv-shimmer" style={{ height: 48, width: "70%", borderRadius: 12, marginTop: 24 }} />
          </div>
        </main>
      )}
      {state.sample && allowed && (
        <p className="wrap" style={{ position: "relative", fontSize: 13, color: "var(--muted-2)", paddingBottom: 32, margin: 0 }}>
          You are viewing a sample case. Specialists, hospitals, prices and visa rules are illustrative; nothing is booked.
        </p>
      )}
    </div>
  );
}
