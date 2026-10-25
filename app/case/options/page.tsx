"use client";

import Link from "next/link";
import { useState } from "react";
import { AssistantPrompt, StepDots } from "@/components/bv/Assistant";
import { Arrow, ChevronUp } from "@/components/bv/icons";
import { explainOption } from "@/lib/assistant";
import { BUDGETS, COORDINATION_FEE, ORIGIN_BY_ID, PRIORITY_BY_ID, type PriorityId } from "@/lib/data";
import { COST_VIEWS, fmtAppt, firstName, routeLabel, viewLines } from "@/lib/engine";
import { useCurrency } from "@/lib/currency";
import { useCase, useCaseModel } from "@/lib/store";

const SHORT: Record<PriorityId, string> = {
  experience: "Specialist experience",
  language: "Language and culture",
  cost: "Total cost",
  family: "Close to family",
  speed: "How soon it starts",
};

export default function OptionsPage() {
  const { state, setIntake, patch } = useCase();
  const { options, widened } = useCaseModel();
  const { money, cur } = useCurrency();
  const i = state.intake;
  const patient = firstName(i.patientName) || "you";
  const [step, setStep] = useState(state.chosenId ? 1 : 0);
  const [sel, setSel] = useState(state.chosenId);
  const [swap, setSwap] = useState(0);

  const view = state.costView;
  const maxT = Math.max(...options.map((o) => o.totals.high), 1);
  const budgetMax = BUDGETS.find((b) => b.id === i.budget)?.max ?? null;
  const budgetPct = budgetMax && Number.isFinite(budgetMax) ? Math.min(100, (budgetMax / maxT) * 100) : null;
  const so = options.find((o) => o.hospital.id === sel) ?? null;
  const originCity = i.originCity || (i.origin ? ORIGIN_BY_ID[i.origin].city : "home");
  const explain = so ? explainOption(so, options, money, originCity) : null;

  const moveUp = (k: number) => {
    const o = [...i.priorities];
    const [p] = o.splice(k, 1);
    o.splice(k - 1, 0, p);
    setIntake({ priorities: o });
    setSwap((s) => s + 1);
  };
  const choose = (id: typeof sel) => {
    setSel(id);
    setSwap((s) => s + 1);
  };
  const confirm = () => {
    if (!so) return;
    if (state.chosenId !== so.hospital.id) patch({ chosenId: so.hospital.id, chosenAt: new Date().toISOString(), planApprovedAt: null, approved: [] });
    setStep(2);
  };

  const top = options[0];
  const second = options[1];
  const prompts = [
    {
      ack: `I compared ${options.length} partner hospitals for ${patient}${widened ? ", widening the search so you have a real choice" : ""}.`,
      title: "Here’s how they stack up.",
      help: "Bars show expected all-in totals. Move a priority up and I’ll re-rank them instantly.",
    },
    {
      ack: top ? (second && top.match === second.match ? `${top.hospital.city} and ${second.hospital.city} are tied on your priorities.` : `${top.hospital.city} fits your priorities best.`) : "",
      title: "Which one should we plan around?",
      help: "Tap one to see why it fits and what the trade-off is.",
    },
    {
      ack: so ? `Nice. ${so.hospital.city} it is.` : "",
      title: "Confirm your choice.",
      help: so ? `I’ll build the plan around ${so.specialist.name}’s schedule. You can switch later and the plan updates.` : "",
    },
  ];
  const P = prompts[step];
  const nextOk = step !== 1 || !!so;

  const prios = (
    <div role="group" aria-label="Your priorities, most important first" style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 8 }}>
      {i.priorities.map((p, k) => (
        <span key={`${p}${swap}`} className="bv-swap" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: k ? "4px 4px 4px 10px" : "4px 14px 4px 10px", borderRadius: 999, background: "rgba(247,244,236,0.08)", border: "1px solid rgba(247,244,236,0.14)", fontSize: 15, fontWeight: 600 }}>
          <span className="badge" style={{ minWidth: 22, height: 22, fontSize: 12 }}>{k + 1}</span>
          {SHORT[p]}
          {k > 0 && (
            <button type="button" onClick={() => moveUp(k)} aria-label={`Move ${SHORT[p]} up`} style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "rgba(247,244,236,0.12)", color: "var(--mint-soft)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronUp size={14} />
            </button>
          )}
        </span>
      ))}
    </div>
  );

  return (
    <main className="wrap flow-main">
      <section aria-label="Assistant" className="flow-section">
        <AssistantPrompt ack={P.ack} title={P.title} help={P.help} status={step === 1 && !so ? "Waiting for your pick" : "Ready when you are"}>
          {step === 0 && (
            <div>
              {prios}
              <div className="card-d" style={{ marginTop: 24, position: "relative" }}>
                <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {options.map((o, k) => (
                    <li key={o.hospital.id} style={{ display: "flex", alignItems: "center", gap: 12, transition: "transform .4s ease" }}>
                      <span style={{ width: 20, flex: "none", fontWeight: 800, color: "var(--muted-2)" }}>{k + 1}</span>
                      <span style={{ width: 84, flex: "none", fontWeight: 700 }}>{o.hospital.city}</span>
                      <div style={{ flex: 1, height: 28, position: "relative", minWidth: 60 }}>
                        <span className="bv-grow" style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 8, transition: "width .8s cubic-bezier(.2,.7,.2,1)", width: `${(o.totals.expected / maxT) * 100}%`, background: o.budget.status === "above" ? "repeating-linear-gradient(135deg, #F3AE78 0 8px, #F7C9A2 8px 16px)" : "linear-gradient(90deg, #197C78, #6FD0C3)" }} />
                        {budgetPct !== null && (
                          <span aria-hidden="true" style={{ position: "absolute", top: -7, bottom: -7, left: `${budgetPct}%`, width: 2, background: "var(--sand)", zIndex: 2 }}>
                            {k === 0 && <span style={{ position: "absolute", top: -20, left: 6, whiteSpace: "nowrap", fontSize: 12, fontWeight: 800, color: "var(--sand)" }}>Budget · up to {money(budgetMax!)}</span>}
                          </span>
                        )}
                      </div>
                      <span style={{ width: 110, flex: "none", textAlign: "right", fontWeight: 800 }}>{money(o.totals.expected)}</span>
                      <span key={`${o.match}`} className="bv-swap hide-sm" style={{ width: 52, flex: "none", textAlign: "right", fontSize: 14, color: "var(--mint-soft)", fontWeight: 700 }}>{o.match}%</span>
                    </li>
                  ))}
                </ol>
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "var(--muted)" }}>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--mint)" }} />Within budget</span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "repeating-linear-gradient(135deg, #F3AE78 0 3px, #F7C9A2 3px 6px)" }} />Above budget</span>
                  <span>% = fit with your priorities (planning score, not a clinical rating)</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {options.map((o, k) => {
                  const on = sel === o.hospital.id;
                  const within = o.budget.status !== "above";
                  return (
                    <button key={o.hospital.id} type="button" className={`tile bv-tile bv-in${on ? " is-on" : ""}`} onClick={() => choose(o.hospital.id)} aria-pressed={on} style={{ padding: 14, animationDelay: `${k * 0.05}s` }}>
                      <span style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 13, fontWeight: 800, color: on ? "var(--ink-soft)" : "var(--muted-2)" }}>
                        <span>#{k + 1}</span>
                        <span>{o.match}%</span>
                      </span>
                      <span style={{ fontSize: 19, fontWeight: 800 }}>{o.hospital.city}</span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{money(o.totals.expected)}</span>
                      <span className="pill" style={{ fontSize: 12, padding: "2px 8px", ...(within ? (on ? { background: "var(--sage)", color: "var(--teal-ink)" } : { background: "rgba(111,208,195,0.16)", color: "var(--mint-soft)" }) : on ? { background: "#FCE7D6", color: "var(--rust)" } : { background: "rgba(243,174,120,0.18)", color: "var(--sand-soft)" }) }}>
                        {o.budget.status === "unknown" ? "No budget set" : within ? "Within budget" : "Over budget"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {so && explain && (
                <div key={swap} className="bv-swap card-d" style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{so.hospital.name}</div>
                      <div style={{ fontSize: 15, color: "var(--muted)" }}>{so.hospital.city} · {routeLabel(so)}</div>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--muted)" }}>Expected {money(so.totals.expected)} · range {money(so.totals.low)}–{money(so.totals.high).replace(/^[^0-9]+/, "")}</div>
                  </div>
                  <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 16, background: "rgba(111,208,195,0.1)" }}>
                    <div className="eyebrow" style={{ letterSpacing: "0.08em", color: "var(--mint-soft)" }}>Why it fits · AI</div>
                    <div style={{ marginTop: 4 }}>{explain.why}</div>
                    <div style={{ marginTop: 6, fontSize: 15, color: "var(--sand-soft)" }}>
                      <strong>Trade-off:</strong> {explain.trade}
                    </div>
                  </div>
                  <dl style={{ margin: "14px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 15 }}>
                    {[["Specialist", so.specialist.name, `${so.specialist.role} · ${so.specialist.years} yrs`], ["Language", so.lang.text, ""], ["First appointment", fmtAppt(so), ""], ["Estimated stay", `About ${so.stayDays} nights`, ""]].map(([a, b, c]) => (
                      <div key={a}>
                        <dt style={{ fontSize: 13, color: "var(--muted)" }}>{a}</dt>
                        <dd style={{ margin: 0, fontWeight: 700 }}>{b}</dd>
                        {c && <dd style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{c}</dd>}
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}

          {step === 2 && so && (
            <div className="card-l" style={{ marginTop: 22, padding: 26, borderRadius: 26, maxWidth: 680 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow" style={{ color: "var(--teal-ink)" }}>Your choice</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" }}>{so.hospital.name}</div>
                  <div style={{ fontSize: 15, color: "var(--ink-soft)" }}>{so.hospital.city} · {routeLabel(so)}</div>
                </div>
                <div role="group" aria-label="Cost view" style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: "#EAE6DA" }}>
                  {COST_VIEWS.map((v) => (
                    <button key={v.id} type="button" onClick={() => patch({ costView: v.id })} aria-pressed={view === v.id} style={{ minHeight: 40, padding: "0 16px", borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, cursor: "pointer", background: view === v.id ? "var(--navy)" : "transparent", color: view === v.id ? "var(--ivory)" : "var(--navy)" }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16, fontSize: 14, color: "var(--ink-soft)" }}>{COST_VIEWS.find((v) => v.id === view)?.label} all-in total · {cur.code} at sample rates</div>
              <div key={view + cur.code} className="bv-swap" style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                {money(so.totals[view])}
              </div>
              <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 15 }}>
                {viewLines(so, view).map((l, k) => (
                  <li key={l.id} className="bv-in" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(20,45,59,0.08)", animationDelay: `${k * 0.06}s` }}>
                    <span style={{ color: "var(--ink-soft)" }}>{l.label}</span>
                    <span style={{ fontWeight: 700 }}>{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--rust)" }}>
                <strong>Could change:</strong> {so.hospital.couldChange}
              </p>
            </div>
          )}

          <div className="actions" style={{ marginTop: 28 }}>
            {step === 0 ? (
              <Link href="/case/second-opinion" className="btn btn-outline">Back</Link>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {step === 0 && (
              <button type="button" className="btn btn-primary bv-btn" onClick={() => setStep(1)}>
                Continue
                <Arrow size={18} />
              </button>
            )}
            {step === 1 && (
              <button type="button" className="btn btn-primary bv-btn" onClick={confirm} aria-disabled={!nextOk}>
                {so ? `Plan around ${so.hospital.city}` : "Pick a hospital to continue"}
                <Arrow size={18} />
              </button>
            )}
            {step === 2 && (
              <Link href="/case/plan" className="btn btn-primary bv-btn">
                Build my plan
                <Arrow size={18} />
              </Link>
            )}
            <StepDots step={step} total={3} />
          </div>
        </AssistantPrompt>
      </section>

      <aside aria-label="Your choice so far" className="panel bv-in" style={{ animationDelay: ".2s" }}>
        <h2>Your choice so far</h2>
        <div key={sel ?? "none"} className={sel ? "bv-flash" : ""} style={{ marginTop: 14, padding: 16, borderRadius: 18, background: "rgba(247,244,236,0.06)" }}>
          <div className="eyebrow" style={{ color: "var(--sand)" }}>Current pick</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{so ? so.hospital.city : "Not chosen yet"}</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            {so ? `${money(so.totals.expected)} expected · ${so.budget.status === "above" ? "over budget" : "within budget"}` : "You’ll choose in the next step"}
          </div>
        </div>
        <div className="eyebrow" style={{ marginTop: 18, color: "var(--muted-2)" }}>Your priorities</div>
        <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {i.priorities.map((p, k) => (
            <li key={`${p}${swap}`} className="bv-swap" style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 8px", borderRadius: 10, fontSize: 15 }}>
              <span className="badge" style={{ minWidth: 20, height: 20, fontSize: 12, background: "rgba(111,208,195,0.18)", color: "var(--mint-soft)" }}>{k + 1}</span>
              {PRIORITY_BY_ID[p].label}
            </li>
          ))}
        </ol>
        <dl style={{ margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
          {[
            ["Medical budget", BUDGETS.find((b) => b.id === i.budget)?.id === "unsure" || !i.budget ? "Not set" : i.budget === "o100" ? `Over ${money(100000)}` : i.budget === "u25" ? `Under ${money(25000)}` : i.budget === "25-50" ? `${money(25000)}–${money(50000).replace(/^[^0-9]+/, "")}` : `${money(50000)}–${money(100000).replace(/^[^0-9]+/, "")}`],
            ["Within budget", `${options.filter((o) => o.budget.status === "within").length} of ${options.length} options`],
            ["Coordination fee", money(COORDINATION_FEE)],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <dt style={{ color: "var(--muted)" }}>{a}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{b}</dd>
            </div>
          ))}
        </dl>
        <p className="panel-foot">Hospitals are paid directly. Prices are sample estimates until a hospital confirms a quote.</p>
      </aside>
    </main>
  );
}
