"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AssistantPrompt, StepDots } from "@/components/bv/Assistant";
import Globe from "@/components/bv/Globe";
import { Arrow, Check } from "@/components/bv/icons";
import { COORDINATOR, ORIGIN_BY_ID, type OriginId } from "@/lib/data";
import { depositFor, firstName, pendingChange } from "@/lib/engine";
import { addDays, fmtDay } from "@/lib/format";
import { useCurrency } from "@/lib/currency";
import { recordProgress, useCase, useCaseModel } from "@/lib/store";

const NATIONALITY: Record<OriginId, string> = {
  jordan: "Jordanian",
  saudi: "Saudi",
  uae: "Emirati",
  lebanon: "Lebanese",
  egypt: "Egyptian",
  uk: "British",
  nz: "New Zealander",
  other: "As on passport",
};

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { state, patch, openChat } = useCase();
  const { chosen: o, plan } = useCaseModel();
  const { money } = useCurrency();
  const i = state.intake;
  const hala = firstName(COORDINATOR.name);
  const decided = state.scanDecision !== "pending";
  const [step, setStep] = useState(!decided ? 0 : !state.passportAdded ? 1 : 2);
  const [feedN, setFeedN] = useState(2);

  useEffect(() => {
    if (feedN >= 5) return;
    const t = window.setTimeout(() => setFeedN((n) => n + 1), 3200);
    return () => window.clearTimeout(t);
  }, [feedN]);

  if (!o || !plan || !state.planApprovedAt) {
    return (
      <main className="wrap flow-main">
        <section className="flow-section">
          <AssistantPrompt title="Approve your plan first." help="Your journey home fills in once the plan is approved. Nothing is booked until then." status="Waiting for you">
            <div className="actions">
              <Link href="/case/plan" className="btn btn-primary bv-btn">
                Open the plan
                <Arrow size={18} />
              </Link>
            </div>
          </AssistantPrompt>
        </section>
      </main>
    );
  }

  const now = new Date();
  const fl = o.route.mode === "flight";
  const shift = state.approved.some((a) => a.id === "moved") ? 2 : 0;
  const travel = addDays(plan.travel, shift);
  const days = Math.max(0, Math.round((travel.getTime() - now.getTime()) / 86400000));
  const origin = ORIGIN_BY_ID[i.origin ?? "other"];
  const originCity = i.originCity || origin.city;
  const patient = firstName(i.patientName) || "the patient";
  const whose = i.forWhom === "self" ? "your" : `${patient}’s`;
  const ch = pendingChange(i, o);
  const pf = state.passportAdded;
  const adj = state.approved.reduce((s, a) => s + a.amount, 0);
  const deposit = depositFor(o);
  const expected = o.totals.expected + adj + (state.scanDecision === "approved" ? ch.amount : state.scanDecision === "cheaper" && ch.cheaper ? ch.cheaper.amount : 0);
  const t = (id: string) => plan.tasks.find((x) => x.id === id)!;

  const decide = (v: "approved" | "cheaper") => {
    patch({ scanDecision: v });
    window.setTimeout(() => setStep(1), 1500);
  };
  const decisionNote = state.scanDecision === "cheaper" ? "Scan near home chosen. I’ve told the team." : state.scanDecision === "approved" ? "Scan at the hospital approved." : "";

  const prompts = [
    { ack: `${greeting(now)}${i.managerName ? `, ${firstName(i.managerName)}` : ""}. Everything is on track.`, title: decided ? "Decision recorded." : "One decision needs you today.", help: ch.why },
    { ack: decisionNote || "Next up.", title: `Add ${whose} passport details.`, help: `${hala} needs them to verify the entry checklist and hold ${fl ? "the flights" : "the arrangements"}.` },
    { ack: "You’re all set for now. I’ll nudge you when something needs you.", title: `${days} days until ${o.hospital.city}.`, help: `Here’s everything in order. ${hala} is one tap away if anything changes.` },
  ];
  const P = prompts[step];
  const nextOk = step === 0 ? decided : step === 1 ? pf : true;

  const tile = { position: "relative" as const, gap: 4, padding: 22, minHeight: 160, borderRadius: 22 };
  const fields: [string, string][] = [
    ["Name as in passport", i.patientName.toUpperCase()],
    ["Nationality", NATIONALITY[i.origin ?? "other"]],
    ["Passport expiry", "March 2031 (sample)"],
  ];

  const itin: { title: string; date: Date; note: string; kind: "done" | "next" | "up" }[] = [
    { title: "Plan approved", date: new Date(state.planApprovedAt), note: "Deposit recorded (simulated)", kind: "done" },
    { title: "Records sent to the hospital", date: t("records").due, note: "Translated file, courier for physical samples", kind: "next" },
    { title: "Video consultation", date: t("consult").due, note: `With ${o.specialist.name}`, kind: "up" },
    { title: fl ? `Fly to ${o.hospital.city}` : `Drive to ${o.hospital.city}`, date: travel, note: o.route.label, kind: "up" },
    { title: "First appointment", date: addDays(plan.first, shift), note: `${o.specialist.name}’s clinic`, kind: "up" },
    { title: "Treatment", date: addDays(plan.treatment, shift), note: "Around this date, set by the team", kind: "up" },
    { title: "Home", date: plan.home, note: "After clinician sign-off", kind: "up" },
  ];

  const rp = recordProgress(state, now);
  const docs = [
    { label: "Medical records", status: `${rp.ready + rp.translating} of ${rp.total}`, pct: ((rp.ready + rp.translating) / Math.max(1, rp.total)) * 100, ok: rp.missing === 0, color: "var(--mint)" },
    { label: "Translations", status: rp.translating ? "In progress" : "Done", pct: rp.translating ? 60 : 100, ok: !rp.translating, color: "var(--mint)" },
    { label: "Passport details", status: pf ? "Added" : "Needed", pct: pf ? 100 : 0, ok: pf, color: pf ? "var(--mint)" : "var(--sand)" },
    { label: "Entry checklist", status: o.visa.sameCountry || !o.visa.needed ? "Not needed" : pf ? "Verifying" : "Waiting", pct: o.visa.sameCountry || !o.visa.needed ? 100 : pf ? 60 : 10, ok: o.visa.sameCountry || !o.visa.needed, color: o.visa.sameCountry || !o.visa.needed ? "var(--mint)" : "var(--sand)" },
  ];

  const lastHala = [...state.chat].reverse().find((m) => m.from === "coordinator");
  const allFeed: [string, string, string][] = [
    ["HM", `${hala} confirmed the video consultation for ${fmtDay(t("consult").due)}, 11:00.`, "2 hours ago"],
    ["AI", "The records file was checked and translated for the hospital.", "Yesterday"],
    ["HM", `A room near ${o.hospital.name} is on hold (sample).`, "Just now"],
    ["AI", state.secondOpinionAt ? `The second-opinion panel received ${whose} file.` : "Second opinion: still available from your plan if you want one.", "Just now"],
    ["AI", pf ? `Passport details received. ${hala} is verifying the entry checklist.` : "Passport details are the next thing I need.", "Just now"],
  ];
  if (lastHala && state.chat.length > 1) allFeed.splice(1, 0, ["HM", lastHala.text, "Latest message"]);
  const feed = allFeed.slice(0, feedN).reverse();

  return (
    <main className="wrap flow-main">
      <section aria-label="Assistant" className="flow-section">
        <AssistantPrompt ack={P.ack} title={P.title} help={P.help} status={step === 2 ? "Watching for updates" : "Waiting for you"}>
          {step === 0 && (
            <div>
              <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                <button type="button" className={`tile bv-tile bv-in${state.scanDecision === "approved" ? " is-on" : ""}`} onClick={() => decide("approved")} aria-pressed={state.scanDecision === "approved"} style={tile}>
                  <span className="sub">At {o.hospital.city}, on arrival</span>
                  <span style={{ fontSize: 30, fontWeight: 800 }}>{money(ch.amount)}</span>
                  <span className="sub" style={{ fontSize: 15 }}>{ch.title}. Added to the hospital bill. No extra trip.</span>
                </button>
                {ch.cheaper && (
                  <button type="button" className={`tile bv-tile bv-in${state.scanDecision === "cheaper" ? " is-on" : ""}`} onClick={() => decide("cheaper")} aria-pressed={state.scanDecision === "cheaper"} style={{ ...tile, borderColor: state.scanDecision === "cheaper" ? "var(--ivory)" : "rgba(111,208,195,0.6)", animationDelay: ".08s" }}>
                    <span style={{ position: "absolute", top: -11, right: 16, fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999, background: "var(--mint)", color: "var(--navy)" }}>AI suggests · saves {money(ch.amount - ch.cheaper.amount)}</span>
                    <span className="sub">Near home, before travel</span>
                    <span style={{ fontSize: 30, fontWeight: 800 }}>{money(ch.cheaper.amount)}</span>
                    <span className="sub" style={{ fontSize: 15 }}>The team has agreed to accept it (sample).</span>
                  </button>
                )}
              </div>
              {decided && (
                <p className="bv-swap toast" role="status" style={{ margin: "16px 0 0" }}>
                  <Check size={16} style={{ color: "var(--mint)" }} />
                  {decisionNote}
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="card-d" style={{ marginTop: 24, maxWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {fields.map(([label, value], k) => (
                  <div key={label} style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(247,244,236,0.06)", border: `1.5px solid ${pf ? "rgba(111,208,195,0.5)" : "rgba(247,244,236,0.12)"}`, minHeight: 64 }}>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
                    {pf ? (
                      <div style={{ fontWeight: 700, fontSize: 18 }}>
                        <span className="bv-type" style={{ animationDelay: `${k * 0.5}s` }}>{value}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, color: "#7f978f" }}>Not added</div>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--muted)" }}>Prototype: uses sample details only and never asks for a real passport number.</p>
              <button type="button" className="btn btn-outline bv-btn" style={{ marginTop: 14, minHeight: 48 }} onClick={() => patch({ passportAdded: true })}>
                {pf ? "✓ Sample details added" : "Use sample details"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: "0 1 300px", minWidth: 240, borderRadius: 26, background: "rgba(8,22,30,0.35)", border: "1px solid rgba(247,244,236,0.1)", padding: 6 }}>
                <Globe routes={[{ a: [origin.lon ?? 35.85, origin.lat ?? 32.55], b: [o.hospital.lon, o.hospital.lat], aLabel: originCity, bLabel: o.hospital.city }]} active={0} plane={fl} showAll={false} />
              </div>
              <ol style={{ flex: "1 1 300px", minWidth: 0, margin: 0, padding: 0, listStyle: "none" }}>
                {itin.map((it, k) => (
                  <li key={it.title} className="bv-in" style={{ display: "flex", gap: 12, animationDelay: `${k * 0.08}s` }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 18 }}>
                      <span aria-hidden="true" style={{ width: 14, height: 14, marginTop: 4, borderRadius: 999, background: it.kind === "done" ? "var(--mint)" : it.kind === "next" ? "var(--sand)" : "transparent", border: it.kind === "up" ? "2px solid rgba(247,244,236,0.35)" : 0, boxShadow: it.kind === "next" ? "0 0 0 4px rgba(243,174,120,0.25)" : "none" }} />
                      {k < itin.length - 1 && <span aria-hidden="true" style={{ width: 2, flex: 1, minHeight: 14, marginTop: 2, background: it.kind === "done" ? "var(--mint)" : "rgba(247,244,236,0.15)" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700 }}>{it.title}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDay(it.date)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>{it.note}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="actions" style={{ marginTop: 26 }}>
            {step === 0 ? (
              <Link href="/case/plan" className="btn btn-outline">Open the plan</Link>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {step < 2 && (
              <button type="button" className="btn btn-primary bv-btn" onClick={() => nextOk && setStep(step + 1)} aria-disabled={!nextOk}>
                {step === 0 ? (decided ? "Continue" : "Choose one to continue") : pf ? "Save and continue" : "Add details to continue"}
                <Arrow size={18} />
              </button>
            )}
            {step === 1 && !pf && <button type="button" className="link-btn" onClick={() => setStep(2)}>Do this later</button>}
            {step === 2 && <button type="button" className="btn btn-outline" onClick={() => openChat()}>Message {hala}</button>}
            <StepDots step={step} total={3} />
          </div>
        </AssistantPrompt>
      </section>

      <aside aria-label="Your journey" className="panel bv-in" style={{ animationDelay: ".2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="92" height="92" viewBox="0 0 84 84" role="img" aria-label={`${days} days until travel`} style={{ flex: "none" }}>
            <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(247,244,236,0.12)" strokeWidth="6" />
            <circle cx="42" cy="42" r="34" fill="none" stroke="#F3AE78" strokeWidth="6" strokeLinecap="round" strokeDasharray="213.6" transform="rotate(-90 42 42)" style={{ strokeDashoffset: 213.6 * Math.min(1, days / 21), animation: "bvRingDraw 1.4s cubic-bezier(.2,.7,.2,1) both" }} />
            <text x="42" y="45" textAnchor="middle" fontSize="24" fontWeight="800" fill="#F7F4EC">{days}</text>
            <text x="42" y="57" textAnchor="middle" fontSize="7" fontWeight="700" fill="#B8C7C3">DAYS TO GO</text>
          </svg>
          <div>
            <h2>{originCity} → {o.hospital.city}</h2>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>{fl ? "Fly" : "Drive"} {fmtDay(travel)} · {o.route.label}</div>
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: 18, color: "var(--muted-2)" }}>Documents</div>
        <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((d) => (
            <li key={d.label + d.status} className="bv-swap" style={{ padding: "4px 6px", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span>{d.label}</span>
                <span className={`pill ${d.ok ? "pill-ok" : "pill-wait"}`}>{d.status}</span>
              </div>
              <div aria-hidden="true" style={{ marginTop: 5, height: 4, borderRadius: 999, background: "rgba(247,244,236,0.1)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 999, transition: "width .8s cubic-bezier(.2,.7,.2,1)", background: d.color, width: `${d.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div className="eyebrow" style={{ marginTop: 18, color: "var(--muted-2)" }}>Budget</div>
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--muted)" }}>Committed (deposit, simulated)</span>
          <strong>{money(deposit)}</strong>
        </div>
        <div aria-hidden="true" style={{ marginTop: 6, height: 8, borderRadius: 999, background: "rgba(247,244,236,0.1)", overflow: "hidden" }}>
          <span className="bv-grow" style={{ display: "block", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #197C78, #6FD0C3)", width: `${Math.round((deposit / expected) * 100)}%` }} />
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>of {money(expected)} expected</div>

        <div className="eyebrow" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: "var(--muted-2)" }}>
          Updates <span className="bv-ring" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--sand)", display: "inline-block" }} />
        </div>
        <ul aria-live="polite" style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {feed.map(([who, text, when], k) => (
            <li key={text} className={k === 0 && feedN > 2 ? "bv-new" : "bv-in"} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, background: "rgba(247,244,236,0.05)" }}>
              <span className="avatar" aria-hidden="true" style={{ width: 30, height: 30, fontSize: 11, ...(who === "HM" ? { background: "var(--sand)" } : { background: "rgba(111,208,195,0.18)", color: "var(--mint-soft)" }) }}>{who}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{text}</div>
                <div style={{ fontSize: 12, color: "var(--muted-2)" }}>{when}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
