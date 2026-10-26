"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { normEmail, useCase } from "@/domains/case/state/store";
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
  const { state, ready, hasActive, session } = useCase();
  const path = usePathname();
  const router = useRouter();
  const allowed = ready && !!session && hasActive && state.complete && normEmail(state.intake.email) === session.email;

  // Cases are private to the signed-in email: send everyone else to log in, or to their list of cases.
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!allowed) router.replace("/account");
  }, [ready, session, allowed, path, router]);

  const active = Math.max(1, PHASES.findIndex((p) => p.href === path));

  return (
    <div className="flow">
      <FlowBackdrop />
      <JourneyBar active={active} />
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
