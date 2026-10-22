"use client";

import Link from "next/link";
import { COORDINATOR, DX_INFO, DX_VOLUME, PANEL, SECOND_OPINION_FEE, type DxId } from "@/lib/data";
import { firstName } from "@/lib/engine";
import { addDays, fmtDay, usd } from "@/lib/format";
import { recordProgress, useCase } from "@/lib/store";
import { CheckIcon } from "@/components/Icons";

const STEPS = [
  { label: "Records checked", detail: "We confirm the file is complete and translated." },
  { label: "Panel assigned", detail: "Three specialists get the same file, independently." },
  { label: "Reviews written", detail: "Each specialist writes back in plain language." },
  { label: "Report and video consultation", detail: "One call with the panel lead, interpreter included." },
];

export default function SecondOpinionPage() {
  const { state, patch } = useCase();
  const dx: DxId = state.intake.diagnosis ?? "other";
  const info = DX_INFO[dx];
  const patient = firstName(state.intake.patientName) || "the patient";
  const requested = state.secondOpinionAt ? new Date(state.secondOpinionAt) : null;
  const progress = recordProgress(state, new Date());
  const gaps = progress.missing;

  return (
    <div className="page">
      <h2 className="page-title">Get a remote second opinion</h2>
      <p className="page-lede">
        Three independent specialists review {patient}&apos;s records and write back in plain language: where they agree,
        where they don&apos;t, and what it means for you. No travel needed.
      </p>

      <div className="panel-grid">
        {PANEL.map((p) => (
          <article key={p.name} className="card panel-card">
            <span className="avatar avatar-lg">{p.initials}</span>
            <h3>{p.name}</h3>
            <p className="panel-role">{info[p.role]}</p>
            <p className="panel-org">{p.org}</p>
            <p className="panel-stat">
              {p.years} years
              {p.independent ? " · independent reviewer" : ` · ~${Math.max(10, Math.round((p.cases * DX_VOLUME[dx]) / 10) * 10)} similar cases in 5 years`}
            </p>
          </article>
        ))}
      </div>

      {!requested ? (
        <section className="card get-card">
          <div className="get-list">
            <h3>What you get</h3>
            <ul className="ticks">
              <li>
                <CheckIcon width={16} height={16} /> A written report in plain English and Arabic, in 7–10 days
              </li>
              <li>
                <CheckIcon width={16} height={16} /> Each specialist&apos;s view, side by side
              </li>
              <li>
                <CheckIcon width={16} height={16} /> One video consultation with the panel lead, interpreter included
              </li>
            </ul>
            {gaps > 0 && (
              <p className="callout callout-warn">
                {gaps} required {gaps === 1 ? "record is" : "records are"} still missing. You can request the review now, but
                the panel may start later or ask for more.{" "}
                <Link href="/case/records" className="inline-link">
                  Go to records
                </Link>
              </p>
            )}
          </div>
          <div className="get-price">
            <p className="price-label">Bon Voyage fee · flat · credited if you continue to full coordination</p>
            <p className="price">{usd(SECOND_OPINION_FEE)}</p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => patch({ secondOpinionAt: new Date().toISOString() })}
            >
              Request the review
            </button>
            <p className="price-fine">Prototype — no payment is taken.</p>
          </div>
        </section>
      ) : (
        <section className="card status-card" aria-live="polite">
          <div className="status-top">
            <div>
              <p className="eyebrow eyebrow-dark">Review requested</p>
              <h3>Report expected by {fmtDay(addDays(requested, 10))}</h3>
              <p className="rec-hint">
                Requested {fmtDay(requested)}. {COORDINATOR.name} will message you when the panel starts.
              </p>
            </div>
            <span className="badge">{usd(SECOND_OPINION_FEE)} · credited later</span>
          </div>
          <ol className="timeline-list">
            {STEPS.map((s, n) => (
              <li key={s.label} className={n === 0 ? "is-now" : ""}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <strong>{s.label}</strong>
                  <span>{s.detail}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="status-actions">
            <button type="button" className="btn btn-outline-dark" onClick={() => patch({ secondOpinionAt: null })}>
              Cancel the request
            </button>
          </div>
        </section>
      )}

      <div className="page-actions">
        <Link href="/case/records" className="btn btn-outline-dark">
          Back to records
        </Link>
        <Link href="/case/options" className="btn btn-primary">
          {requested ? "Next: compare treatment options" : "Skip to treatment options"}
        </Link>
      </div>
    </div>
  );
}
