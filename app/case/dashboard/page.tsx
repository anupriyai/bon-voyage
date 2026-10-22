"use client";

import Link from "next/link";
import { COORDINATOR, DX_INFO } from "@/lib/data";
import {
  depositFor,
  firstName,
  ownerOf,
  pendingChange,
  statusOf,
  STATUS_LABEL,
  type TaskStatus,
} from "@/lib/engine";
import { fmtDay, fmtTime, signedUsd, usd } from "@/lib/format";
import { useCase, useCaseModel } from "@/lib/store";

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  na: "na",
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

export default function DashboardPage() {
  const { state, update, openChat } = useCase();
  const { chosen, plan, impact } = useCaseModel();

  if (!chosen || !plan || !impact) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Your dashboard starts once you choose an option</h2>
          <p>Compare the options, pick one, and we will track the costs, tasks and dates here.</p>
          <Link href="/case/options" className="btn btn-primary">
            Compare treatment options
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const approved = !!state.planApprovedAt;
  const patient = firstName(state.intake.patientName) || "the patient";
  const manager = firstName(state.intake.managerName);
  const ctx = {
    owners: state.owners,
    taskStatus: state.taskStatus,
    planApproved: approved,
    consultBooked: !!state.consultSlot,
    now,
  };

  const live = plan.tasks.filter((t) => !t.na);
  const statuses = live.map((t) => ({ t, status: statusOf(t, ctx) }));
  const counts = {
    done: statuses.filter((s) => s.status === "done").length,
    progress: statuses.filter((s) => s.status === "in_progress").length,
    todo: statuses.filter((s) => s.status === "not_started").length,
  };

  const req = pendingChange(state.intake, chosen);
  const changeSum = state.approved.reduce((s, c) => s + c.amount, 0);
  const deposit = approved ? depositFor(chosen) : 0;
  const committed = approved ? deposit + changeSum : 0;
  const expectedAllIn = impact.exp + changeSum;
  const withReq = expectedAllIn + req.amount;
  const withCheaper = req.cheaper ? expectedAllIn + req.cheaper.amount : null;
  const pct = Math.min(100, expectedAllIn > 0 ? (committed / expectedAllIn) * 100 : 0);
  const inRange = (v: number) => v <= impact.high;

  const decide = (decision: "approved" | "cheaper") =>
    update((s) => {
      const amount = decision === "cheaper" && req.cheaper ? req.cheaper.amount : req.amount;
      const label = decision === "cheaper" ? `${req.title} (done near home)` : req.title;
      return {
        ...s,
        scanDecision: decision,
        approved: [
          ...s.approved.filter((c) => c.id !== req.id),
          { id: req.id, label, amount, at: new Date().toISOString() },
        ],
      };
    });
  const undo = () =>
    update((s) => ({ ...s, scanDecision: "pending", approved: s.approved.filter((c) => c.id !== req.id) }));

  const travelTask = plan.tasks.find((t) => t.id === "travel");
  const consultTask = plan.tasks.find((t) => t.id === "consult");
  const travelOwner = travelTask ? ownerOf(travelTask, state.owners) : "bv";
  const travelers = state.intake.forWhom === "family" && manager ? `${patient} and ${manager}` : patient;
  const consultDate = state.consultSlot ? new Date(state.consultSlot) : consultTask?.due;
  const events = [
    consultTask && consultDate
      ? {
          date: consultDate,
          title: consultTask.title,
          sub: state.consultSlot ? `Online · ${fmtTime(consultDate)} · booked` : "Online · not booked yet",
        }
      : null,
    {
      date: plan.travel,
      title: chosen.route.mode === "drive" ? `Drive to ${chosen.hospital.city}` : `Fly to ${chosen.hospital.city}`,
      sub: travelOwner === "self" ? `${travelers} · you arrange it` : `${travelers} · Bon Voyage arranges it`,
    },
    { date: plan.first, title: "First appointment", sub: chosen.hospital.name },
    { date: plan.treatment, title: DX_INFO[state.intake.diagnosis ?? "other"].surgery, sub: chosen.specialist.name },
    { date: plan.home, title: "Expected home", sub: `After about ${chosen.stayDays} days` },
  ].filter((e): e is { date: Date; title: string; sub: string } => e !== null);
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="page">
      <div className="dash-head">
        <div>
          <h2 className="page-title">Case dashboard</h2>
          <p className="page-lede dash-sub">
            {chosen.specialist.name} · {chosen.hospital.name}, {chosen.hospital.city}
          </p>
        </div>
        <div className="owner-row">
          <span className="pill-soft pill-done">{counts.done} done</span>
          <span className="pill-soft pill-bv">{counts.progress} in progress</span>
          <span className="pill-soft">{counts.todo} not started</span>
        </div>
      </div>

      {!approved && (
        <p className="callout callout-warn">
          Your plan isn&apos;t approved yet, so nothing is booked or committed.{" "}
          <Link href="/case/plan" className="inline-link">
            Review and approve the plan
          </Link>
        </p>
      )}

      <div className="split-layout">
        <div className="split-main">
          <section className="card cost-card" aria-labelledby="cost-h">
            <h3 id="cost-h">Costs so far vs. estimate</h3>
            <div className="cost-figs">
              <div>
                <span className="sum-k">Committed so far</span>
                <strong className="fig">{usd(committed)}</strong>
              </div>
              <div>
                <span className="sum-k">Expected all-in</span>
                <strong className="fig">{usd(expectedAllIn)}</strong>
              </div>
              <div>
                <span className="sum-k">Original range</span>
                <strong className="fig fig-sm">
                  {usd(impact.low)} – {usd(impact.high)}
                </strong>
              </div>
            </div>
            <div
              className="meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              aria-label="Committed share of the expected total"
            >
              <span style={{ width: `${pct}%` }} />
            </div>

            <ul className="ledger">
              <li>
                <span>Hospital deposit (paid directly to the hospital)</span>
                <span>{approved ? usd(deposit) : "After you approve the plan"}</span>
              </li>
              {state.approved.map((c) => (
                <li key={c.id}>
                  <span>
                    Change you approved on {fmtDay(new Date(c.at))}: {c.label}
                  </span>
                  <span>{signedUsd(c.amount)}</span>
                </li>
              ))}
              {impact.delta.exp !== 0 && (
                <li>
                  <span>
                    Your plan choices vs. all Bon Voyage <Link href="/case/plan" className="inline-link">(see plan)</Link>
                  </span>
                  <span>{signedUsd(impact.delta.exp)}</span>
                </li>
              )}
            </ul>

            {approved && state.scanDecision === "pending" && (
              <div className="change-card">
                <p className="change-top">
                  <span className="chip-s chip-warn">Needs your OK · not charged yet</span>
                  <strong>
                    +{usd(req.amount)} · {req.title}
                  </strong>
                </p>
                <p>
                  <strong>Why:</strong> {req.why}
                </p>
                {req.cheaper && (
                  <p>
                    <strong>Cheaper option:</strong> {req.cheaper.text}
                  </p>
                )}
                <p className="change-result">
                  If approved, the expected total becomes {usd(withReq)} —{" "}
                  {inRange(withReq) ? "still inside your original range." : "above your original range."}
                </p>
                <div className="change-actions">
                  <button type="button" className="btn btn-primary" onClick={() => decide("approved")}>
                    Approve + {usd(req.amount)}
                  </button>
                  {req.cheaper && withCheaper !== null && (
                    <button type="button" className="btn btn-outline-dark" onClick={() => decide("cheaper")}>
                      Ask for the cheaper option ({usd(withCheaper)} total)
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={() => openChat(`I have a question about the ${req.title}: `)}
                  >
                    Ask {firstName(COORDINATOR.name)}
                  </button>
                </div>
              </div>
            )}
            {approved && state.scanDecision !== "pending" && (
              <p className="callout callout-ok">
                {state.scanDecision === "cheaper"
                  ? "You asked for the cheaper option. The team will confirm the scan at home."
                  : `You approved: ${req.title}.`}{" "}
                <button type="button" className="link-btn" onClick={undo}>
                  Undo
                </button>
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="tasks-h">
            <h3 id="tasks-h" className="card-title">
              Tasks
            </h3>
            <ul className="task-table">
              {statuses.map(({ t, status }) => {
                const owner = ownerOf(t, state.owners);
                return (
                  <li key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {owner === "bv" ? "Bon Voyage" : "You"} · due {fmtDay(t.due)}
                      </small>
                    </div>
                    <span
                      className={`chip-s ${status === "done" ? "chip-ok" : status === "in_progress" ? "chip-info" : "chip-muted"}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                    {owner === "self" ? (
                      <button
                        type="button"
                        className="btn btn-outline-dark btn-sm"
                        onClick={() => update((s) => ({ ...s, taskStatus: { ...s.taskStatus, [t.id]: NEXT_STATUS[status] } }))}
                      >
                        {status === "not_started" ? "Start" : status === "in_progress" ? "Mark done" : "Reopen"}
                      </button>
                    ) : (
                      <span className="task-note">{approved ? "We are on it" : "Starts when you approve"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="split-side">
          <section className="card side-card" aria-labelledby="up-h">
            <h3 id="up-h">Coming up</h3>
            <ul className="upcoming">
              {events.map((e) => (
                <li key={e.title + e.date.toISOString()}>
                  <span className="date-tile">{fmtDay(e.date).replace(/^(\w+) /, "$1 \n")}</span>
                  <div>
                    <strong>{e.title}</strong>
                    <span>{e.sub}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card side-card coord-card">
            <div className="coord-top">
              <span className="avatar avatar-lg avatar-warm">{COORDINATOR.initials}</span>
              <div>
                <strong>{COORDINATOR.name}</strong>
                <span>{COORDINATOR.blurb}</span>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => openChat()}>
              Message {firstName(COORDINATOR.name)}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
