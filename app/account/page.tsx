"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FlowHeader from "@/components/FlowHeader";
import { caseTitle, managedLine } from "@/lib/engine";
import { fmtDay } from "@/lib/format";
import { resumePath, useCase, type CaseState } from "@/lib/store";
import { hospitalLabel, recordProgressLabel } from "@/lib/summary";

function stage(c: CaseState): string {
  if (c.planApprovedAt) return `Plan approved · ${hospitalLabel(c)}`;
  if (c.chosenId) return `Planning · ${hospitalLabel(c)}`;
  if (c.secondOpinionAt) return "Second opinion requested · compare options next";
  return recordProgressLabel(c);
}

export default function AccountPage() {
  const { ready, session, myCases, draft, openCase, deleteCase, startDraft, loadSample } = useCase();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login?next=/account");
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <>
        <FlowHeader exitLabel="Back to home" />
        <main className="container case-main" aria-busy="true">
          <div className="wiz-skeleton" />
        </main>
      </>
    );
  }

  const open = (c: CaseState) => {
    openCase(c.id);
    router.push(resumePath(c));
  };

  return (
    <>
      <FlowHeader exitLabel="Back to home" />
      <main className="container case-main account">
        <h1 className="page-title">My cases</h1>
        <p className="page-lede">Signed in as {session.email}. Everything you add is saved to the case.</p>

        {draft && (
          <section className="card draft-card" aria-label="Unfinished request">
            <div>
              <p className="eyebrow eyebrow-dark">Unfinished request</p>
              <h2>{draft.intake.patientName}</h2>
              <p className="q-help">You stopped at step {draft.draftStep} of 5. Your answers are saved.</p>
            </div>
            <div className="draft-actions">
              <button type="button" className="link-btn" onClick={() => deleteCase(draft.id)}>
                Discard
              </button>
              <Link href="/start" className="btn btn-primary" onClick={() => startDraft()}>
                Continue request
              </Link>
            </div>
          </section>
        )}

        <ul className="case-list">
          {myCases.map((c) => (
            <li key={c.id} className="card case-item">
              <div className="case-item-main">
                <h2>{caseTitle(c.intake)}</h2>
                <p className="case-sub">{managedLine(c.intake)}</p>
                <p className="case-stage">
                  {c.sample && <span className="chip-s chip-warn">Sample</span>} {stage(c)}
                </p>
                <p className="rec-hint">Updated {fmtDay(new Date(c.updatedAt))}</p>
              </div>
              <div className="case-item-actions">
                <button type="button" className="btn btn-primary" onClick={() => open(c)}>
                  Open case
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    if (window.confirm("Delete this case from this browser? This can't be undone.")) deleteCase(c.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {myCases.length === 0 && !draft && (
          <div className="empty-state">
            <h2>No cases yet</h2>
            <p>Tell us about the situation and we will build the case from there.</p>
          </div>
        )}

        <div className="page-actions">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              loadSample();
              router.push("/case/about");
            }}
          >
            Add a sample case
          </button>
          {!draft && (
            <Link href="/start" className="btn btn-primary" onClick={() => startDraft()}>
              New request
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
