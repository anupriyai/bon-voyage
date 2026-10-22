"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COORDINATION_FEE, COORDINATOR, INSURANCE, PRIORITY_BY_ID, SECOND_OPINION_FEE } from "@/lib/data";
import {
  COST_VIEWS,
  firstName,
  fmtAppt,
  priorityWeights,
  routeLabel,
  type OptionResult,
} from "@/lib/engine";
import { usd } from "@/lib/format";
import { useCase, useCaseModel } from "@/lib/store";
import PriorityRanker from "@/components/PriorityRanker";

function BudgetBadge({ o }: { o: OptionResult }) {
  if (o.budget.status === "unknown") return <span className="chip-s chip-muted">Budget not set</span>;
  if (o.budget.status === "within") return <span className="chip-s chip-ok">Inside your budget</span>;
  return <span className="chip-s chip-warn">{usd(o.budget.overBy)} above your budget</span>;
}

export default function OptionsPage() {
  const { state, patch, update, setIntake, openChat } = useCase();
  const { options, widened } = useCaseModel();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const view = state.costView;
  const patient = firstName(state.intake.patientName) || "the patient";
  const weights = priorityWeights(state.intake.priorities);
  const insured = state.intake.insurance === "partial" || state.intake.insurance === "program";

  const choose = (o: OptionResult) => {
    const id = o.hospital.id;
    if (state.chosenId === id) {
      router.push("/case/plan");
      return;
    }
    const hasProgress = state.chosenId && (state.planApprovedAt || Object.keys(state.owners).length > 0);
    if (hasProgress && !window.confirm("Switching option resets your plan, task choices and approvals. Continue?")) return;
    update((s) => ({
      ...s,
      chosenId: id,
      chosenAt: new Date().toISOString(),
      owners: {},
      taskStatus: {},
      consultSlot: null,
      planApprovedAt: null,
      scanDecision: "pending",
      approved: [],
    }));
    router.push("/case/plan");
  };

  return (
    <div className="page">
      <div className="opt-head">
        <div>
          <h2 className="page-title">
            {options.length} options matched to {patient}&apos;s case
          </h2>
          <p className="page-lede">
            Each option is scored only against the priorities you set. These are options, not recommendations.
          </p>
        </div>
        <div className="seg-wrap">
          <span id="cost-view-label" className="seg-label">
            Show costs as
          </span>
          <div className="seg" role="group" aria-labelledby="cost-view-label">
            {COST_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`seg-btn${view === v.id ? " is-on" : ""}`}
                aria-pressed={view === v.id}
                onClick={() => patch({ costView: v.id })}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {widened && (
        <p className="callout callout-warn">
          Fewer than two places matched your choices, so we are showing every option we have.{" "}
          <Link href="/start?edit=1&step=5" className="inline-link">
            Change where you would go
          </Link>
        </p>
      )}

      <section className="card prio-card" aria-label="Your priorities">
        <div className="prio-row">
          <strong>Your priorities, in order:</strong>
          <ol className="priority-chips">
            {state.intake.priorities.map((p, n) => (
              <li key={p} className="pill-soft">
                {n + 1}. {PRIORITY_BY_ID[p].label}
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Change order"}
          </button>
        </div>
        {editing && (
          <div className="prio-edit">
            <p className="q-help">Move the most important first. Scores and the order of options update straight away.</p>
            <PriorityRanker order={state.intake.priorities} onChange={(priorities) => setIntake({ priorities })} />
          </div>
        )}
      </section>

      <section className="card glance" aria-labelledby="glance-h">
        <h3 id="glance-h" className="glance-title">
          At a glance
        </h3>
        <div className="table-scroll">
          <table className="glance-table">
            <thead>
              <tr>
                <td />
                {options.map((o) => (
                  <th key={o.hospital.id} scope="col">
                    <span className="th-city">{o.hospital.city}</span>
                    <span className="th-name">{o.hospital.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Match to your priorities</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>
                    <strong>{o.match}%</strong>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Specialist</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>{o.specialist.name}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Similar cases</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>~{o.specialist.cases}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">First appointment</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>{fmtAppt(o)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Distance from family</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>{routeLabel(o)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Language and culture</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>{o.lang.text}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Total medical and stay</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>
                    <strong>{usd(o.totals[view])}</strong>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Your budget</th>
                {options.map((o) => (
                  <td key={o.hospital.id}>
                    <BudgetBadge o={o} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="opt-grid">
        {options.map((o, idx) => {
          const best = idx === 0;
          const isChosen = state.chosenId === o.hospital.id;
          return (
            <article key={o.hospital.id} className={`card opt-card${best ? " is-best" : ""}`}>
              {best && <p className="best-tag">Highest match to your priorities</p>}
              <div className="opt-card-top">
                <div>
                  <h3>{o.hospital.city}</h3>
                  <p className="opt-hospital">{o.hospital.name}</p>
                </div>
                <span className="match-badge" aria-label={`${o.match} percent match`}>
                  {o.match}%
                </span>
              </div>
              <p className="opt-spec">
                <strong>{o.specialist.name}</strong>
                <br />
                {o.specialist.role} · {o.specialist.years} years · ~{o.specialist.cases} similar cases
              </p>

              <h4 className="opt-sub">How it scored on your priorities</h4>
              <ul className="score-list">
                {state.intake.priorities.map((p) => (
                  <li key={p}>
                    <span className="score-name">
                      {PRIORITY_BY_ID[p].label} <small>· weight {Math.round(weights[p] * 100)}%</small>
                    </span>
                    <span
                      className="bar"
                      role="img"
                      aria-label={`${PRIORITY_BY_ID[p].label}: ${Math.round(o.scores[p] * 100)} out of 100`}
                    >
                      <span style={{ width: `${Math.round(o.scores[p] * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>

              <ul className="facts-list">
                <li>
                  <span>First appointment</span>
                  <strong>{fmtAppt(o)}</strong>
                </li>
                <li>
                  <span>Getting there</span>
                  <strong>{routeLabel(o)}</strong>
                </li>
                <li>
                  <span>Language and culture</span>
                  <strong>{o.lang.text}</strong>
                </li>
              </ul>
              <p className="culture-note">{o.hospital.cultureNote}</p>

              <h4 className="opt-sub">Cost, {COST_VIEWS.find((v) => v.id === view)?.label.toLowerCase()} case</h4>
              <ul className="cost-lines">
                {o.lines.map((l) => (
                  <li key={l.id}>
                    <span>{l.label}</span>
                    <span>{usd(l[view])}</span>
                  </li>
                ))}
              </ul>
              <div className="cost-total">
                <span>Total medical and stay</span>
                <strong>{usd(o.totals[view])}</strong>
              </div>
              <p className="cost-range">
                Range {usd(o.totals.low)} – {usd(o.totals.high)}
              </p>
              <BudgetBadge o={o} />

              <p className="change-box">
                <strong>What could change this:</strong> {o.hospital.couldChange}
              </p>

              <div className="opt-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={() => choose(o)}>
                  {isChosen ? "Continue with this option" : "Choose this option"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-dark btn-block"
                  onClick={() =>
                    openChat(`Hi, I have a question about ${o.hospital.name} in ${o.hospital.city}: `)
                  }
                >
                  Ask {COORDINATOR.name.split(" ")[0]} about this option
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="two-up">
        <section className="card note-card">
          <h3>Bon Voyage&apos;s fee is separate</h3>
          <p>
            Full coordination: <strong>{usd(COORDINATION_FEE)} flat</strong> for this treatment episode, whichever option you
            choose. If you also get a second opinion, its {usd(SECOND_OPINION_FEE)} fee is deducted. Medical costs above are
            paid directly to the hospital and suppliers. We take no commission from any hospital.
          </p>
          {insured && (
            <p>
              {INSURANCE.find((i) => i.id === state.intake.insurance)?.label}: ask your insurer what it covers abroad. We can
              prepare the cost letter and records they usually ask for.
            </p>
          )}
          <p>
            You can also take parts of the care on yourselves.{" "}
            <span className="inline-note">The plan shows what that does to the estimate.</span>
          </p>
        </section>
        <section className="card note-card note-warm">
          <h3>The decision is {patient}&apos;s</h3>
          <p>
            Scores only reflect the order you chose. Talk the options through with {patient} and your own doctor. Choosing
            here books nothing — you can change your mind until treatment begins.
          </p>
        </section>
      </div>
    </div>
  );
}
