"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AssistantPrompt, ProgressRow, StepDots } from "@/shared/ui/Assistant";
import Globe from "@/shared/ui/Globe";
import { Arrow, Check } from "@/shared/ui/Icons";
import { aiClassifyChange } from "@/domains/case/assistantClient";
import { CHANGE_CHIPS, scenario, type ChangeId, type Scenario } from "@/domains/case/model/assistant";
import { COORDINATION_FEE, COORDINATOR, ORIGIN_BY_ID } from "@/domains/case/data/catalogue";
import { PHASES, depositFor, firstName, ownerOf, taskDelta, type Owner } from "@/domains/case/model/engine";
import { addDays, fmtDay } from "@/shared/lib/format";
import { useCurrency } from "@/shared/lib/currency";
import { useCase, useCaseModel } from "@/domains/case/state/store";

const PAY_STEPS = ["Checking your plan", `Sending approval to ${firstName(COORDINATOR.name)}`, "Recording the deposit (simulation)", "Preparing your journey home"];

export default function PlanPage() {
  const { state, patch, update, openChat } = useCase();
  const { chosen: o, plan, impact } = useCaseModel();
  const { money, signed, cur } = useCurrency();
  const i = state.intake;
  const approved = !!state.planApprovedAt;

  const [step, setStep] = useState(approved ? 3 : 0);
  const [askText, setAskText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [prop, setProp] = useState<Scenario | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean; n: number } | null>(null);
  const [halaAsked, setHalaAsked] = useState(false);
  const [pay, setPay] = useState(approved ? 5 : 0);
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [flash, setFlash] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (pay === 0 || pay >= 5) return;
    const t = window.setTimeout(() => {
      setPay(pay + 1);
      if (pay + 1 >= 5) patch({ planApprovedAt: new Date().toISOString() });
    }, 900);
    return () => window.clearTimeout(t);
  }, [pay, patch]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!o || !plan || !impact) {
    return (
      <main className="wrap flow-main">
        <section className="flow-section">
          <AssistantPrompt title="Pick a hospital first." help="Your plan is built around the hospital you choose. It takes a minute." status="Waiting for your choice">
            <div className="actions">
              <Link href="/case/options" className="btn btn-primary bv-btn">
                Compare options
                <Arrow size={18} />
              </Link>
            </div>
          </AssistantPrompt>
        </section>
      </main>
    );
  }

  const fl = o.route.mode === "flight";
  const origin = ORIGIN_BY_ID[i.origin ?? "other"];
  const originCity = i.originCity || origin.city;
  const applied = state.approved;
  const shift = applied.some((a) => a.id === "moved") ? 2 : 0;
  const extra = applied.filter((a) => a.id === "companion").length;
  const adjTotal = applied.reduce((s, a) => s + a.amount, 0);
  const baseT = impact.exp + adjTotal;
  const deposit = depositFor(o);
  const day = (d: Date) => fmtDay(d);

  const keyDates = [
    { label: fl ? "Fly" : "Drive", value: addDays(plan.travel, shift), note: o.route.label.replace(/ from .*/, ""), moves: true },
    { label: "First appointment", value: addDays(plan.first, shift), note: o.specialist.name, moves: true },
    { label: "Treatment around", value: addDays(plan.treatment, shift), note: "Set by the surgeon’s team", moves: true },
    { label: "Home around", value: plan.home, note: "After clinician sign-off", moves: false },
  ];
  const tasks = plan.tasks.filter((t) => !t.na);
  const setOwner = (id: string, owner: Owner) => {
    update((s) => ({ ...s, owners: { ...s.owners, [id]: owner } }));
    setFlash((f) => f + 1);
  };

  const propose = async (id: ChangeId | null, text: string) => {
    setThinking(true);
    setProp(null);
    setToast(null);
    const started = performance.now();
    const which = id ?? (await aiClassifyChange(text));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setThinking(false);
      setProp(scenario(which, text, o, plan, day));
    }, Math.max(0, 1400 - (performance.now() - started)));
  };
  const sum = (s: Scenario) => s.rows.reduce((n, r) => n + r.cost, 0);

  const prompts = [
    { ack: `Here’s the trip I built around ${o.specialist.name}’s schedule.`, title: `Your trip to ${o.hospital.city}.`, help: "Every date is linked to the appointments. If one moves, I update the rest." },
    { ack: "Next, who does what.", title: "Should I handle these for you?", help: "Bon Voyage handles every step by default. Switch any to “I’ll do it” and I’ll show what it changes." },
    { ack: "The plan looks complete.", title: "Anything you’d like to change?", help: "Ask in your own words. I’ll draft it and show everything it affects. Nothing is booked." },
    {
      ack: pay >= 5 ? "All set. Welcome aboard." : "Last step.",
      title: pay >= 5 ? "Your plan is approved." : "Review and approve your plan.",
      help: pay >= 5 ? "Your journey home keeps everything in one place from here." : "Estimates stay estimates until the hospital confirms. The deposit goes straight to the hospital.",
    },
  ];
  const P = prompts[step];
  const busy = thinking || (pay > 0 && pay < 5);
  const status = thinking ? "Drafting the change" : pay > 0 && pay < 5 ? "Processing (simulation)" : "Ready when you are";

  return (
    <main className="wrap flow-main">
      <section aria-label="Assistant" className="flow-section">
        <AssistantPrompt ack={P.ack} title={P.title} help={P.help} status={status} busy={busy} mode={busy ? "think" : "idle"}>
          {step === 0 && (
            <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: 440, position: "relative", borderRadius: 28, background: "rgba(8,22,30,0.35)", border: "1px solid rgba(247,244,236,0.1)", padding: 6 }}>
                <Globe routes={[{ a: [origin.lon ?? 35.85, origin.lat ?? 32.55], b: [o.hospital.lon, o.hospital.lat], aLabel: originCity, bLabel: o.hospital.city }]} active={0} plane={fl} showAll={false} />
                <span style={{ position: "absolute", left: 16, bottom: 14, padding: "6px 12px", borderRadius: 999, background: "rgba(20,45,59,0.85)", border: "1px solid rgba(247,244,236,0.18)", fontSize: 14 }}>{o.route.label}</span>
              </div>
              <ol style={{ flex: "1 1 220px", minWidth: 0, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {keyDates.map((k, n) => (
                  <li key={k.label} className="bv-in card-d" style={{ padding: "14px 16px", borderRadius: 18, animationDelay: `${0.1 + n * 0.1}s` }}>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{day(k.value)}</div>
                    <div style={{ fontSize: 13, color: "var(--mint-soft)" }}>{k.note}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step === 1 && (
            <div>
              <ul style={{ margin: "22px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map((t, n) => {
                  const self = ownerOf(t, state.owners) === "self";
                  const d = taskDelta(t).exp;
                  return (
                    <li key={t.id} className="bv-in" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 16, background: "rgba(247,244,236,0.05)", border: "1px solid rgba(247,244,236,0.1)", boxShadow: `inset 3px 0 0 ${self ? "var(--sand)" : "var(--mint)"}`, animationDelay: `${n * 0.05}s` }}>
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--muted)" }}>{PHASES.find((p) => p.id === t.phase)?.label} · due {day(t.due)}</div>
                        <div style={{ fontWeight: 700 }}>{t.title}</div>
                        <div className={self ? "bv-swap" : ""} style={{ fontSize: 13, color: self ? "var(--sand-soft)" : "var(--muted)" }}>
                          {self ? `${d === 0 ? "Same cost" : d > 0 ? `About ${money(d)} more` : `About ${money(-d)} less`} · ~${t.hours} hr of your time · ${t.whySelf}` : t.whyBv}
                        </div>
                      </div>
                      <div role="group" aria-label={`Who handles: ${t.title}`} className="seg">
                        <button type="button" onClick={() => setOwner(t.id, "bv")} aria-pressed={!self} style={!self ? { background: "var(--teal)", color: "#fff" } : undefined}>Bon Voyage</button>
                        <button type="button" onClick={() => setOwner(t.id, "self")} aria-pressed={self} style={self ? { background: "var(--sand)", color: "var(--navy)" } : undefined}>I’ll do it</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p key={flash} className={flash ? "bv-flash" : ""} style={{ margin: "14px 0 0", padding: "12px 16px", borderRadius: 16, background: "rgba(247,244,236,0.06)", fontSize: 15 }}>
                <strong>Effect on the estimate:</strong>{" "}
                {impact.selfCount === 0 ? "none. Bon Voyage handles every step." : `between ${signed(impact.delta.low)} and ${signed(impact.delta.high)}, plus about ${impact.hours} hours of your time.`}
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (askText.trim()) propose(null, askText.trim());
                }}
                style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}
              >
                <label htmlFor="bv-ask" className="sr-only">Describe a change</label>
                <input id="bv-ask" type="text" value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="e.g. My brother wants to come too" className="field" style={{ flex: "1 1 320px", width: "auto", minHeight: 58, borderRadius: 999, fontSize: 18, padding: "0 22px" }} />
                <button type="submit" className="btn btn-primary bv-btn" style={{ minHeight: 58 }}>Draft it</button>
              </form>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CHANGE_CHIPS.map((c) => (
                  <button key={c.id} type="button" className="bv-chip" onClick={() => { setAskText(c.label); propose(c.id, c.label); }} style={{ minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1.5px solid rgba(247,244,236,0.2)", background: "rgba(247,244,236,0.04)", color: "var(--ivory)", fontSize: 15, cursor: "pointer" }}>
                    “{c.label}”
                  </button>
                ))}
              </div>
              {thinking && (
                <div className="bv-swap card-d" aria-hidden="true" style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {["86%", "68%", "76%"].map((w) => <span key={w} className="bv-shimmer" style={{ height: 14, borderRadius: 8, width: w }} />)}
                </div>
              )}
              {prop && (
                <div className="bv-swap card-l" style={{ marginTop: 18, boxShadow: "inset 0 0 0 2px var(--sand)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div className="eyebrow" style={{ letterSpacing: "0.08em", color: "var(--rust)" }}>Proposed change · AI draft</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>“{prop.ask}”</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        <span style={{ color: "var(--ink-mute)", textDecoration: "line-through", fontWeight: 600 }}>{money(baseT)}</span> → {money(baseT + sum(prop))}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: sum(prop) > 0 ? "var(--rust)" : "var(--teal-ink)" }}>{signed(sum(prop))}</div>
                    </div>
                  </div>
                  <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {prop.rows.map((r, n) => (
                      <li key={r.item} className="bv-swap" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", padding: "10px 12px", borderRadius: 12, background: "#fff", animationDelay: `${n * 0.12}s` }}>
                        <span style={{ width: 140, flex: "none", fontWeight: 700 }}>{r.item}</span>
                        <span style={{ flex: 1, minWidth: 180, color: "var(--ink-soft)" }}>
                          {r.from} <span aria-hidden="true" style={{ color: "var(--teal)", fontWeight: 800 }}>→</span> <strong style={{ color: "var(--navy)" }}>{r.to}</strong>
                        </span>
                        <span style={{ width: 100, flex: "none", textAlign: "right", fontWeight: 800 }}>{signed(r.cost)}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
                    <strong>Waiting on:</strong>
                    {prop.pending.map((w) => <span key={w} style={{ fontSize: 13, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#FCE7D6", color: "var(--rust)" }}>{w}</span>)}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-mute)" }}>{prop.note}</p>
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary bv-btn"
                      style={{ minHeight: 48, border: 0 }}
                      onClick={() => {
                        update((s) => ({ ...s, approved: [...s.approved.filter((a) => a.id !== prop.id), { id: prop.id, label: prop.short, amount: sum(prop), at: new Date().toISOString() }] }));
                        setProp(null);
                        setAskText("");
                        setFlash((f) => f + 1);
                        setToast({ text: `Applied to your draft. Nothing is booked; ${firstName(COORDINATOR.name)} will confirm the details.`, undo: true, n: (toast?.n ?? 0) + 1 });
                      }}
                    >
                      Apply to my draft
                    </button>
                    <button type="button" className="btn btn-outline-ink" style={{ minHeight: 48 }} onClick={() => { setProp(null); setAskText(""); setToast({ text: "Kept your current plan. Nothing changed.", undo: false, n: (toast?.n ?? 0) + 1 }); }}>
                      Keep current plan
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-ink"
                      style={{ minHeight: 48 }}
                      onClick={() => {
                        setHalaAsked(true);
                        openChat(`About my plan: “${prop.ask}”. The draft shows ${signed(sum(prop))}. Can you check ${prop.pending.join(" and ").toLowerCase()}?`);
                      }}
                    >
                      {halaAsked ? `✓ Asked ${firstName(COORDINATOR.name)}` : `Ask ${firstName(COORDINATOR.name)}`}
                    </button>
                  </div>
                </div>
              )}
              {toast && (
                <div key={toast.n} className="bv-swap toast" role="status" style={{ marginTop: 14, display: "flex", flexWrap: "wrap", borderRadius: 18, fontWeight: 400 }}>
                  <Check size={18} style={{ color: "var(--mint)" }} />
                  <span style={{ flex: "1 1 220px" }}>{toast.text}</span>
                  {toast.undo && (
                    <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40, borderColor: "rgba(247,244,236,0.35)" }} onClick={() => { update((s) => ({ ...s, approved: s.approved.slice(0, -1) })); setFlash((f) => f + 1); setToast({ text: "Undone. Your draft is back to how it was.", undo: false, n: toast.n + 1 }); }}>
                      Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              {pay === 0 && (
                <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <div className="card-l" style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <div className="eyebrow" style={{ color: "var(--teal-ink)" }}>Estimate · {cur.code}</div>
                    <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                      {o.lines.map((l, n) => (
                        <li key={l.id} className="bv-in" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(20,45,59,0.08)", fontSize: 15, animationDelay: `${n * 0.06}s` }}>
                          <span style={{ color: "var(--ink-soft)" }}>{l.label}</span>
                          <span style={{ fontWeight: 700 }}>{money(l.expected)}</span>
                        </li>
                      ))}
                      {impact.selfCount > 0 && (
                        <li style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(20,45,59,0.08)", color: "var(--rust)", fontSize: 15 }}>
                          <span>{impact.selfCount} steps you handle</span>
                          <span style={{ fontWeight: 700 }}>{signed(impact.delta.exp)}</span>
                        </li>
                      )}
                      {applied.map((a) => (
                        <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(20,45,59,0.08)", color: "var(--rust)", fontSize: 15 }}>
                          <span>{a.label}</span>
                          <span style={{ fontWeight: 700 }}>{signed(a.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong>Expected total</strong>
                      <span style={{ fontSize: 28, fontWeight: 800 }}>{money(baseT)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-mute)", textAlign: "right" }}>
                      Range {money(impact.low + adjTotal)}–{money(impact.high + adjTotal).replace(/^[^0-9]+/, "")} · plus {money(COORDINATION_FEE)} coordination fee
                    </div>
                  </div>
                  <div className="card-d" style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div className="eyebrow" style={{ color: "var(--sand)" }}>Deposit due now</div>
                    <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{money(deposit)}</div>
                    <div style={{ fontSize: 14, color: "#dce6e2" }}>Paid directly to {o.hospital.name}. Bon Voyage never holds the money.</div>
                    <div role="group" aria-label="Payment method" style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["card", "bank"] as const).map((m) => (
                        <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} style={{ minHeight: 42, padding: "0 14px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer", ...(method === m ? { border: 0, background: "var(--ivory)", color: "var(--navy)" } : { border: "1.5px solid rgba(247,244,236,0.25)", background: "transparent", color: "var(--ivory)" }) }}>
                          {m === "card" ? "Card (sample)" : "Bank transfer (sample)"}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>Sample terms: full deposit refund if you cancel 7+ days before the first appointment. For illustration only.</p>
                  </div>
                </div>
              )}
              {pay > 0 && pay < 5 && (
                <ol aria-live="polite" style={{ margin: "22px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
                  {PAY_STEPS.map((l, n) => <ProgressRow key={l} title={l} state={pay > n + 1 ? "done" : pay === n + 1 ? "run" : "wait"} />)}
                </ol>
              )}
              {pay >= 5 && (
                <div className="card-l" style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", maxWidth: 680 }}>
                  <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: 64, height: 64, flex: "none" }}>
                    <span className="bv-burst" style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(25,124,120,0.35)" }} />
                    <span className="check-done bv-pop" style={{ position: "relative", width: 64, height: 64 }}><Check size={30} style={{ color: "#fff" }} /></span>
                  </span>
                  <div style={{ flex: "1 1 300px" }}>
                    <div className="bv-in" style={{ fontSize: 22, fontWeight: 800 }}>Plan approved</div>
                    <div className="bv-in" style={{ color: "var(--ink-soft)", animationDelay: ".1s" }}>
                      Deposit of {money(deposit)} recorded as a simulation. No money moved and nothing was booked. {firstName(COORDINATOR.name)} will confirm each arrangement with you.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="actions" style={{ marginTop: 28 }}>
            {step === 0 ? (
              <Link href="/case/options" className="btn btn-outline">Back</Link>
            ) : (
              pay === 0 && <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {pay === 0 && (
              <button type="button" className="btn btn-primary bv-btn" onClick={() => (step < 3 ? (setStep(step + 1), setToast(null)) : setPay(1))}>
                {["Looks right", "Continue", "Looks good, review", "Approve and pay (simulated)"][step]}
                <Arrow size={18} />
              </button>
            )}
            {pay >= 5 && (
              <Link href="/case/dashboard" className="btn btn-primary bv-btn bv-in">
                Go to your journey home
                <Arrow size={18} />
              </Link>
            )}
            <StepDots step={step} total={4} />
          </div>
        </AssistantPrompt>
      </section>

      <aside aria-label="Your plan" className="panel bv-in" style={{ animationDelay: ".2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2>Your plan</h2>
          <span className={`pill ${pay >= 5 ? "" : "pill-wait"}`} style={{ fontSize: 12, padding: "3px 10px", ...(pay >= 5 ? { background: "var(--mint)", color: "var(--navy)" } : {}) }}>{pay >= 5 ? "Approved" : "Draft"}</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800 }}>{o.hospital.name}</div>
        <div style={{ fontSize: 14, color: "var(--muted)" }}>{o.hospital.city} · {o.route.label}</div>
        <div key={flash} className={flash ? "bv-flash" : ""} style={{ marginTop: 16, padding: "14px 16px", borderRadius: 18, background: "rgba(247,244,236,0.06)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Expected total</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{money(baseT)}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Deposit {money(deposit)} · fee {money(COORDINATION_FEE)}</div>
        </div>
        <dl style={{ margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
          {keyDates.map((k) => (
            <div key={`${k.label}${shift}`} className={shift && k.moves ? "bv-flash" : ""} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 6px", borderRadius: 8 }}>
              <dt style={{ color: "var(--muted)" }}>{k.label}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{day(k.value)}</dd>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 6px" }}>
            <dt style={{ color: "var(--muted)" }}>Travellers</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{2 + extra}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 6px" }}>
            <dt style={{ color: "var(--muted)" }}>Steps you handle</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{impact.selfCount || "None"}</dd>
          </div>
        </dl>
        {applied.length > 0 && (
          <div className="bv-swap" style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ color: "var(--sand)" }}>Draft changes</div>
            <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              {applied.map((a) => (
                <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{a.label}</span>
                  <span style={{ fontWeight: 700 }}>{signed(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="panel-foot">A draft until you approve it. Nothing is booked from here.</p>
      </aside>
    </main>
  );
}
