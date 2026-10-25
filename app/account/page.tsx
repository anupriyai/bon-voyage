"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AssistantIdentity } from "@/components/bv/Assistant";
import { FlowBackdrop } from "@/components/bv/CaseShell";
import { PHASES } from "@/components/bv/JourneyBar";
import { SimpleBar } from "@/components/bv/SimpleBar";
import { Arrow, Sparkle } from "@/components/bv/icons";
import { HOSPITAL_BY_ID } from "@/lib/data";
import { caseTitle, managedLine } from "@/lib/engine";
import { fmtDay } from "@/lib/format";
import { resumePath, useCase, type CaseState } from "@/lib/store";

function phaseIndex(c: CaseState): number {
  const path = resumePath(c);
  return Math.max(1, PHASES.findIndex((p) => p.href === path));
}

function stageLine(c: CaseState): string {
  const h = c.chosenId ? HOSPITAL_BY_ID[c.chosenId].city : "";
  if (c.planApprovedAt) return `Plan approved · ${h}`;
  if (c.chosenId) return `Planning around ${h}`;
  if (c.secondOpinionAt) return "Second opinion requested · compare options next";
  if (c.secondOpinionSkipped) return "Comparing options";
  return Object.values(c.records).some((r) => r.files.length) ? "Records in · second opinion next" : "Adding records";
}

export default function AccountPage() {
  const { ready, session, myCases, draft, openCase, deleteCase, startDraft, loadSample } = useCase();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login?next=/account");
  }, [ready, session, router]);

  const open = (c: CaseState) => {
    openCase(c.id);
    router.push(resumePath(c));
  };

  return (
    <div className="flow">
      <FlowBackdrop />
      <SimpleBar />
      <main className="wrap flow-main" aria-busy={!ready || !session}>
        <section className="flow-section">
          <AssistantIdentity status={session ? `Signed in as ${session.email}` : "Checking your session"} />
          <h1 className="bv-in" style={{ margin: 0, fontSize: "clamp(34px, 3.8vw, 50px)", lineHeight: 1.06, letterSpacing: "-0.03em", fontWeight: 800 }}>
            Your journeys
          </h1>
          <p className="bv-in bv-d1" style={{ margin: "12px 0 0", fontSize: 18, color: "var(--muted)" }}>Everything you add is saved to the case. Pick up wherever you left off.</p>

          {draft && (
            <div className="card-d bv-in bv-d2" style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="eyebrow" style={{ color: "var(--sand)" }}>Unfinished story</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{draft.intake.patientName}</div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>Your answers so far are saved.</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="link-btn" onClick={() => deleteCase(draft.id)}>Discard</button>
                <Link href="/start" className="btn btn-primary bv-btn" onClick={() => startDraft()}>Continue</Link>
              </div>
            </div>
          )}

          <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {myCases.map((c, k) => (
              <li key={c.id} className="card-d bv-in" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", animationDelay: `${0.2 + k * 0.08}s` }}>
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{caseTitle(c.intake)}</span>
                    {c.sample && <span className="pill pill-wait">Sample</span>}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--muted)" }}>{managedLine(c.intake)}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 4, alignItems: "center" }} aria-label={`Step ${phaseIndex(c) + 1} of ${PHASES.length}`}>
                    {PHASES.map((p, n) => (
                      <span key={p.label} style={{ height: 6, flex: 1, maxWidth: 48, borderRadius: 999, background: n < phaseIndex(c) ? "var(--mint)" : n === phaseIndex(c) ? "var(--sand)" : "rgba(247,244,236,0.15)" }} />
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    {stageLine(c)} <span style={{ color: "var(--muted-2)" }}>· updated {fmtDay(new Date(c.updatedAt))}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      if (window.confirm("Delete this case from this browser? This can't be undone.")) deleteCase(c.id);
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" className="btn btn-primary bv-btn" onClick={() => open(c)}>
                    Open
                    <Arrow size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {ready && myCases.length === 0 && !draft && (
            <p className="card-d" style={{ marginTop: 24, color: "#dce6e2" }}>No cases yet. Tell the assistant what’s happening and it builds the case from there.</p>
          )}

          <div className="actions">
            <Link href="/start" className="btn btn-primary bv-btn" onClick={() => startDraft(undefined, true)}>
              Start a new journey
              <Arrow size={18} />
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                loadSample();
                router.push("/case/second-opinion");
              }}
            >
              <Sparkle size={16} style={{ color: "var(--mint)" }} />
              Add a sample case
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
