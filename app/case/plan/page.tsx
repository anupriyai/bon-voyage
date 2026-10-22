"use client";

import Link from "next/link";
import { COORDINATION_FEE, COORDINATOR, SECOND_OPINION_FEE } from "@/lib/data";
import {
  ownerOf,
  PHASES,
  statusOf,
  STATUS_LABEL,
  taskDelta,
  type Impact,
  type Owner,
  type PlanTask,
} from "@/lib/engine";
import { addDays, fmtDay, fmtTime, signedUsd, usd } from "@/lib/format";
import { useCase, useCaseModel } from "@/lib/store";

const COUNTRY: Record<string, string> = {
  jordan: "Jordan",
  egypt: "Egypt",
  turkey: "Turkey",
  uae: "UAE",
  germany: "Germany",
};

type Tone = "save" | "more" | "neutral";

function deltaTone(exp: number): Tone {
  return exp < -4 ? "save" : exp > 4 ? "more" : "neutral";
}

function DeltaChip({ task, owner }: { task: PlanTask; owner: Owner }) {
  const d = taskDelta(task);
  const flat = Math.abs(d.low) < 5 && Math.abs(d.exp) < 5 && Math.abs(d.high) < 5;
  const tone = flat ? "neutral" : deltaTone(d.exp);
  const lead = owner === "bv" ? "If you handle this" : "Compared with Bon Voyage";
  return (
    <p className="delta-line">
      <span className="delta-lead">{lead}:</span>{" "}
      {flat ? (
        <span className="delta delta-neutral">No price difference</span>
      ) : (
        <>
          <span className={`delta delta-${tone}`}>
            {signedUsd(d.exp)} <small>likely</small>
          </span>
          <span className="delta-range">
            range {signedUsd(d.low)} to {signedUsd(d.high)}
          </span>
        </>
      )}
    </p>
  );
}

function ImpactPanel({
  impact,
  fee,
  suggestions,
  onTake,
  onHandBack,
  onReset,
  hasOverrides,
}: {
  impact: Impact;
  fee: number;
  suggestions: { save: PlanTask | null; leave: PlanTask | null };
  onTake: (id: string) => void;
  onHandBack: () => void;
  onReset: () => void;
  hasOverrides: boolean;
}) {
  const d = impact.delta.exp;
  const tone = deltaTone(d);
  const min = Math.min(impact.baseLow, impact.low);
  const max = Math.max(impact.baseHigh, impact.high);
  const span = Math.max(max - min, 1);
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / span) * 100))}%`;
  const maxAbs = Math.max(1, ...impact.items.map((i) => Math.abs(i.exp)));

  return (
    <section className="card impact" aria-labelledby="impact-h">
      <p className="impact-eyebrow">Price impact</p>
      <h3 id="impact-h">What taking part yourself does to the estimate</h3>

      <div className="impact-main">
        <span className="impact-label">Your estimate, medical and stay</span>
        <strong className="impact-total">{usd(impact.exp)}</strong>
        <p className={`impact-delta impact-${tone}`} aria-live="polite">
          {impact.selfCount === 0 ? (
            <>Same as Bon Voyage handling everything.</>
          ) : d === 0 ? (
            <>No change from {usd(impact.baseExp)} with Bon Voyage handling everything.</>
          ) : (
            <>
              <strong>{signedUsd(d)}</strong> vs {usd(impact.baseExp)} with Bon Voyage handling everything
              <span className="impact-range">
                {" "}
                · could land between {signedUsd(impact.delta.low)} and {signedUsd(impact.delta.high)}
              </span>
            </>
          )}
        </p>
      </div>

      <div
        className="range"
        role="img"
        aria-label={`Likely range ${usd(impact.low)} to ${usd(impact.high)}, expected ${usd(impact.exp)}. With Bon Voyage handling everything: ${usd(impact.baseLow)} to ${usd(impact.baseHigh)}, expected ${usd(impact.baseExp)}.`}
      >
        <span className="range-base" style={{ left: pos(impact.baseLow), width: `calc(${pos(impact.baseHigh)} - ${pos(impact.baseLow)})` }} />
        <span className="range-band" style={{ left: pos(impact.low), width: `calc(${pos(impact.high)} - ${pos(impact.low)})` }} />
        <span className="range-tick" style={{ left: pos(impact.baseExp) }} />
        <span className={`range-dot range-dot-${tone}`} style={{ left: pos(impact.exp) }} />
      </div>
      <div className="range-legend">
        <span>{usd(impact.low)}</span>
        <span className="range-key">
          <i className="key-tick" /> all Bon Voyage <i className="key-dot" /> your plan
        </span>
        <span>{usd(impact.high)}</span>
      </div>

      <h4 className="impact-sub">Where the difference comes from</h4>
      {impact.items.length === 0 ? (
        <p className="impact-empty">
          Nothing yet. Switch a task to <strong>You handle this</strong> and its price impact appears here, along with the
          range it could land in.
        </p>
      ) : (
        <ul className="diverge">
          {[...impact.items]
            .sort((a, b) => a.exp - b.exp)
            .map((it) => {
              const t = deltaTone(it.exp);
              const w = `${(Math.abs(it.exp) / maxAbs) * 50}%`;
              return (
                <li key={it.task.id}>
                  <div className="diverge-top">
                    <span>{it.task.title.replace(/^Video consultation with .*/, "Video consultation")}</span>
                    <strong className={`delta-text delta-text-${t}`}>{it.exp === 0 ? "$0" : signedUsd(it.exp)}</strong>
                  </div>
                  <div className="diverge-track" aria-hidden="true">
                    <span className="diverge-axis" />
                    {it.exp !== 0 && (
                      <span
                        className={`diverge-bar diverge-${t}`}
                        style={it.exp < 0 ? { right: "50%", width: w } : { left: "50%", width: w }}
                      />
                    )}
                  </div>
                  <small className="diverge-range">
                    range {signedUsd(it.low)} to {signedUsd(it.high)}
                  </small>
                </li>
              );
            })}
        </ul>
      )}

      <dl className="impact-facts">
        <div>
          <dt>Your time</dt>
          <dd>{impact.hours === 0 ? "None" : `about ${impact.hours} hours`}</dd>
        </div>
        <div>
          <dt>Bon Voyage fee</dt>
          <dd>{usd(fee)}, flat</dd>
        </div>
      </dl>
      <p className="impact-fine">
        The flat fee stays the same whichever tasks you take. Only the rates for the task itself change the estimate.
      </p>

      {(suggestions.save || suggestions.leave) && (
        <div className="suggest">
          {suggestions.save && (
            <div>
              <p>
                <strong>Biggest saving available:</strong> {suggestions.save.title}, about{" "}
                {signedUsd(taskDelta(suggestions.save).exp)}.
              </p>
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => onTake(suggestions.save!.id)}>
                I&apos;ll handle this
              </button>
            </div>
          )}
          {suggestions.leave && (
            <p>
              <strong>Worth leaving to us:</strong> {suggestions.leave.title}, taking it on costs about{" "}
              {signedUsd(taskDelta(suggestions.leave).exp)} more.
            </p>
          )}
        </div>
      )}

      <div className="impact-actions">
        <button type="button" className="link-btn" onClick={onHandBack} disabled={impact.selfCount === 0}>
          Hand everything to Bon Voyage
        </button>
        {hasOverrides && (
          <button type="button" className="link-btn" onClick={onReset}>
            Reset to suggested split
          </button>
        )}
      </div>
    </section>
  );
}

export default function PlanPage() {
  const { state, patch, update } = useCase();
  const { chosen, plan, impact } = useCaseModel();

  if (!chosen || !plan || !impact) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Choose an option first</h2>
          <p>Your plan is built from the option you pick, so the dates, tasks and costs fit it.</p>
          <Link href="/case/options" className="btn btn-primary">
            Compare treatment options
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const fee = COORDINATION_FEE - (state.secondOpinionAt ? SECOND_OPINION_FEE : 0);
  const owners = state.owners;
  const ctx = {
    owners,
    taskStatus: state.taskStatus,
    planApproved: !!state.planApprovedAt,
    consultBooked: !!state.consultSlot,
    now,
  };
  const setOwner = (id: string, owner: Owner) => update((s) => ({ ...s, owners: { ...s.owners, [id]: owner } }));
  const live = plan.tasks.filter((t) => !t.na);

  // Suggestions are based only on the tasks Bon Voyage currently handles.
  const bvTasks = live.filter((t) => ownerOf(t, owners) === "bv");
  const bySaving = [...bvTasks].sort((a, b) => taskDelta(a).exp - taskDelta(b).exp);
  const byExtra = [...bvTasks].sort((a, b) => taskDelta(b).exp - taskDelta(a).exp);
  const suggestions = {
    save: bySaving[0] && taskDelta(bySaving[0]).exp < -50 ? bySaving[0] : null,
    leave: byExtra[0] && taskDelta(byExtra[0]).exp > 50 ? byExtra[0] : null,
  };

  const consultDue = plan.tasks.find((t) => t.id === "consult")?.due ?? plan.base;
  const slots = [0, 1, 2].map((n) => {
    const slot = addDays(consultDue, n);
    slot.setHours(n === 1 ? 14 : n === 2 ? 11 : 10, n === 1 ? 30 : 0, 0, 0);
    return slot;
  });

  return (
    <div className="page">
      <h2 className="page-title">Your plan with {chosen.specialist.name}</h2>
      <p className="page-lede">
        For every task, decide who takes care of it. You can switch at any time. Nothing is booked or paid until you approve
        it.
      </p>

      <section className="card plan-summary" aria-label="Plan summary">
        <div>
          <span className="sum-k">Chosen</span>
          <strong className="sum-v">{chosen.hospital.name}</strong>
          <span className="sum-sub">
            {chosen.hospital.city}, {COUNTRY[chosen.hospital.country]}
          </span>
        </div>
        <div>
          <span className="sum-k">Travel</span>
          <strong className="sum-v">{fmtDay(plan.travel)}</strong>
        </div>
        <div>
          <span className="sum-k">First appointment</span>
          <strong className="sum-v">{fmtDay(plan.first)}</strong>
        </div>
        <div>
          <span className="sum-k">Expected home</span>
          <strong className="sum-v">{fmtDay(plan.home)}</strong>
        </div>
        <div>
          <span className="sum-k">All-in estimate</span>
          <strong className="sum-v">{usd(impact.exp)}</strong>
          <span className="sum-sub">
            {usd(impact.low)} – {usd(impact.high)}
          </span>
        </div>
      </section>

      <div className="owner-row">
        <span className="pill-soft pill-bv">Bon Voyage handles {impact.bvCount}</span>
        <span className="pill-soft pill-you">You handle {impact.selfCount}</span>
        <span className="owner-note">Everything we handle is included in the {usd(fee)} flat fee.</span>
      </div>

      <div className="split-layout plan-layout">
        <div className="split-main">
          {PHASES.map((ph) => {
            const tasks = plan.tasks.filter((t) => t.phase === ph.id);
            if (tasks.length === 0) return null;
            return (
              <section key={ph.id} className="phase" aria-labelledby={`ph-${ph.id}`}>
                <h3 id={`ph-${ph.id}`} className="phase-title">
                  <span className="phase-dot" aria-hidden="true" />
                  {ph.label}
                </h3>
                <ul className="phase-list">
                  {tasks.map((t) => {
                    const owner = ownerOf(t, owners);
                    const status = statusOf(t, ctx);
                    if (t.na) {
                      return (
                        <li key={t.id} className="card task task-na">
                          <div className="task-head">
                            <h4>{t.title}</h4>
                            <span className="chip-s chip-muted">{STATUS_LABEL.na}</span>
                          </div>
                          <p className="task-desc">{t.naText}</p>
                          <p className="task-meta">{fmtDay(t.due)} · Nothing to do</p>
                        </li>
                      );
                    }
                    return (
                      <li key={t.id} className="card task">
                        <div className="task-top">
                          <div className="task-body">
                            <div className="task-head">
                              <h4>{t.title}</h4>
                              <span className={`chip-s ${status === "in_progress" ? "chip-info" : status === "done" ? "chip-ok" : "chip-muted"}`}>
                                {t.id === "consult" && state.consultSlot && status === "in_progress" ? "Booked" : STATUS_LABEL[status]}
                              </span>
                            </div>
                            <p className="task-desc">{t.desc}</p>
                            <p className="task-meta">
                              {t.id === "travel" && t.title.startsWith("Flights") ? "Book by " : "Due "}
                              {fmtDay(t.due)} ·{" "}
                              {owner === "bv"
                                ? t.bv > 0
                                  ? `${usd(t.bv)} in your estimate`
                                  : "Included in your flat fee"
                                : `${usd(t.self.exp)} if you handle it`}
                            </p>
                          </div>
                          <div className="owner-toggle" role="group" aria-label={`Who handles: ${t.title}`}>
                            <button
                              type="button"
                              className={owner === "bv" ? "is-on" : ""}
                              aria-pressed={owner === "bv"}
                              onClick={() => setOwner(t.id, "bv")}
                            >
                              Bon Voyage handles this
                            </button>
                            <button
                              type="button"
                              className={owner === "self" ? "is-on" : ""}
                              aria-pressed={owner === "self"}
                              onClick={() => setOwner(t.id, "self")}
                            >
                              You handle this
                            </button>
                          </div>
                        </div>

                        <DeltaChip task={t} owner={owner} />
                        <p className="task-why">{owner === "bv" ? t.whyBv : t.whySelf}</p>
                        {owner === "self" && t.heads && <p className="callout callout-warn task-heads">{t.heads}</p>}

                        {t.id === "consult" && owner === "bv" && (
                          <div className="slots" role="group" aria-label="Pick a time for the video consultation">
                            <span className="slots-label">Pick a time</span>
                            {slots.map((s) => {
                              const iso = s.toISOString();
                              const on = state.consultSlot === iso;
                              return (
                                <button
                                  key={iso}
                                  type="button"
                                  className={`chip${on ? " is-on" : ""}`}
                                  aria-pressed={on}
                                  onClick={() => patch({ consultSlot: on ? null : iso })}
                                >
                                  {fmtDay(s)} · {fmtTime(s)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <section className="card approve-card" aria-labelledby="approve-h">
            {state.planApprovedAt ? (
              <>
                <h3 id="approve-h">Plan approved on {fmtDay(new Date(state.planApprovedAt))}</h3>
                <p>
                  Bon Voyage starts on the tasks it handles. You stay in control: switch a task back, or ask {COORDINATOR.name.split(" ")[0]} to change anything. Costs and progress are on your dashboard.
                </p>
                <div className="approve-actions">
                  <button type="button" className="btn btn-outline-dark" onClick={() => patch({ planApprovedAt: null })}>
                    Withdraw approval
                  </button>
                  <Link href="/case/dashboard" className="btn btn-primary">
                    Go to dashboard
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 id="approve-h">Ready to go ahead?</h3>
                <p>
                  Approving tells {chosen.hospital.name} and Bon Voyage to start on the tasks assigned above, with your
                  estimate of {usd(impact.exp)} plus our {usd(fee)} flat fee. Prototype — no payment is taken, and you can
                  withdraw until treatment begins.
                </p>
                <div className="approve-actions">
                  <Link href="/case/options" className="btn btn-outline-dark">
                    Compare options again
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => patch({ planApprovedAt: new Date().toISOString() })}
                  >
                    Approve this plan
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="split-side sticky-side" id="price-impact">
          <ImpactPanel
            impact={impact}
            fee={fee}
            suggestions={suggestions}
            onTake={(id) => setOwner(id, "self")}
            onHandBack={() =>
              update((s) => ({ ...s, owners: Object.fromEntries(plan.tasks.map((t) => [t.id, "bv" as Owner])) }))
            }
            onReset={() => patch({ owners: {} })}
            hasOverrides={Object.keys(owners).length > 0}
          />
        </aside>
      </div>
      <div className="impact-bar">
        <span>
          Estimate <strong>{usd(impact.exp)}</strong>
          {impact.selfCount > 0 && <> ({signedUsd(impact.delta.exp)})</>}
        </span>
        <a href="#price-impact">Price impact</a>
      </div>
    </div>
  );
}
