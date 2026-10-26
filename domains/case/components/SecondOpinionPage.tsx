"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AssistantPrompt, ProgressRow, StepDots } from "@/shared/ui/Assistant";
import { Arrow, Check, Sparkle } from "@/shared/ui/Icons";
import { DX_INFO, PANEL, SECOND_OPINION_FEE, recordsFor } from "@/domains/case/data/catalogue";
import { firstName } from "@/domains/case/model/engine";
import { addDays, fmtDay } from "@/shared/lib/format";
import { useCurrency } from "@/shared/lib/currency";
import { itemHandled, useCase } from "@/domains/case/state/store";

const SEND_STEPS: [string, string][] = [
  ["File check", "Complete and translated"],
  ["Independent review", "Three specialists, same file"],
  ["Plain-language reports", "Each writes back separately"],
  ["Report and video call", "With the panel lead, interpreter included"],
];
const COLORS = ["#F3AE78", "#6FD0C3", "#DCE6E2"];

export default function SecondOpinionPage() {
  const { state, patch } = useCase();
  const { money } = useCurrency();
  const i = state.intake;
  const patient = firstName(i.patientName) || "the patient";
  const whose = i.forWhom === "self" ? "your" : `${patient}’s`;
  const info = DX_INFO[i.diagnosis ?? "other"];

  const [step, setStep] = useState(state.secondOpinionAt ? 2 : state.secondOpinionSkipped ? 3 : 0);
  const [send, setSend] = useState(state.secondOpinionAt ? 5 : 0);

  useEffect(() => {
    if (send === 0 || send >= 5) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    const t = window.setTimeout(() => {
      setSend(send + 1);
      if (send + 1 >= 5) patch({ secondOpinionAt: new Date().toISOString(), secondOpinionSkipped: false });
    }, reduced ? 50 : 1100);
    return () => window.clearTimeout(t);
  }, [send, patch]);

  const sent = send >= 5;
  const sending = send > 0 && !sent;
  const fee = money(SECOND_OPINION_FEE);
  const expected = fmtDay(addDays(state.secondOpinionAt ? new Date(state.secondOpinionAt) : new Date(), 7));
  const items = recordsFor(i.diagnosis);
  const files = Object.values(state.records).reduce((n, r) => n + r.files.length, 0);
  const translated = Object.values(state.records).reduce((n, r) => n + r.files.filter((f) => f.translated).length, 0);
  const pending = items.filter((r) => !r.optional && !itemHandled(r.id, state));
  const requested = items.filter((r) => state.records[r.id]?.requested || state.records[r.id]?.courier);

  const panel = PANEL.map((p, k) => ({
    ...p,
    role: p.role === "head" ? info.head : p.role === "surgeon" ? info.surgeon : info.oncologist,
    tag: p.independent ? "Independent" : `${Math.round(p.cases * (i.diagnosis === "breast" ? 1.4 : 1))} similar cases`,
    org: p.independent ? "Independent reviewer" : p.org,
    color: COLORS[k],
  }));

  const stageNote = i.stage && i.stage !== "unsure" ? `stage ${i.stage} treatment plans` : "treatment plans";
  const prompts = [
    { ack: "Records are in. Before you compare hospitals, one optional step.", title: "Would a second opinion help?", help: `Three specialists review ${whose} file independently, then one joins a video call with you.` },
    { ack: "Good choice. Here’s who would review it.", title: "Meet the panel.", help: "Two hospital specialists and one independent reviewer, so no single hospital decides." },
    {
      ack: sent ? "All done. I’ll tell you the moment the report lands." : "Last check before I send it.",
      title: sent ? `The panel has ${whose} file.` : `Ready to send ${whose} file?`,
      help: sent ? "Meanwhile, let’s look at the hospitals. You can compare now and revisit after the report." : requested.length ? `The panel can start with what’s in. I’ll add the ${requested[0].title.split(" ").slice(0, 3).join(" ")} when it arrives.` : "The panel can start with what’s in.",
    },
    { ack: "No problem.", title: "Let’s compare hospitals.", help: "You can still request a second opinion later." },
  ];
  const P = prompts[step];
  const status = sending ? "Sending the file" : step === 0 ? "Waiting for your choice" : sent ? "File sent" : "Ready when you are";
  const statusText = sent ? "Sent" : step === 3 ? "Skipped" : step > 0 ? "Preparing" : "Not requested";

  const checks: { ok: boolean; title: string; note: string }[] = [
    { ok: files > 0, title: "Records file", note: files ? `${files} records${translated ? `, ${translated} translated` : ""}` : "No files yet. The panel will ask for them." },
    ...pending.slice(0, 2).map((r) => ({ ok: false, title: r.title, note: "Still to come · added when it arrives" })),
    { ok: true, title: `Panel fee · ${fee}`, note: "Charged once the report is ready (sample)" },
    { ok: true, title: `Report expected by ${expected}`, note: "Then one video call with the panel lead" },
  ];
  const prog = send >= 5 ? 4 : Math.max(0, send - 1);

  return (
    <main className="wrap flow-main">
      <section aria-label="Assistant" className="flow-section">
        <AssistantPrompt ack={P.ack} title={P.title} help={P.help} status={status} busy={sending} mode={sending ? "think" : "idle"}>
          {step === 0 && (
            <div>
              <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <button type="button" className="tile bv-tile bv-in" onClick={() => setStep(1)} style={{ position: "relative", gap: 6, padding: 22, minHeight: 170, borderRadius: 22, borderColor: "rgba(111,208,195,0.6)", background: "rgba(111,208,195,0.08)" }}>
                  <span style={{ position: "absolute", top: -11, right: 16, fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999, background: "var(--mint)", color: "var(--navy)" }}>AI suggests</span>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>Yes, request it</span>
                  <span className="sub" style={{ fontSize: 15 }}>Panel of three specialists · report in about 5 working days</span>
                  <span style={{ marginTop: "auto", fontSize: 20, fontWeight: 800 }}>{fee}</span>
                </button>
                <button
                  type="button"
                  className="tile bv-tile bv-in"
                  onClick={() => {
                    patch({ secondOpinionSkipped: true });
                    setStep(3);
                  }}
                  style={{ gap: 6, padding: 22, minHeight: 170, borderRadius: 22, animationDelay: ".08s" }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800 }}>Not now</span>
                  <span className="sub" style={{ fontSize: 15 }}>Go straight to comparing hospitals. You can request it later from your plan.</span>
                  <span style={{ marginTop: "auto", fontSize: 15, fontWeight: 700, color: "var(--mint-soft)" }}>Skip for now →</span>
                </button>
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 15, color: "var(--muted)", display: "flex", gap: 8 }}>
                <Sparkle size={16} style={{ color: "var(--mint)", flex: "none", marginTop: 3 }} />
                Why I suggest it: {stageNote} can differ between teams, and the fee is credited if you go ahead with a partner hospital (sample terms).
              </p>
            </div>
          )}

          {step === 1 && (
            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {panel.map((p, k) => (
                <div key={p.name} className="bv-flip card-d" style={{ padding: 20, borderRadius: 22, animationDelay: `${0.15 + k * 0.15}s` }}>
                  <span className="avatar" aria-hidden="true" style={{ width: 56, height: 56, background: p.color }}>{p.initials}</span>
                  <div style={{ marginTop: 14, fontWeight: 800, fontSize: 18 }}>{p.name}</div>
                  <div style={{ fontSize: 15, color: "#dce6e2" }}>{p.role}</div>
                  <div style={{ fontSize: 14, color: "var(--muted)" }}>{p.org}</div>
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="pill pill-ok" style={{ fontSize: 12, padding: "3px 9px" }}>{p.years} years</span>
                    <span className="pill pill-mute" style={{ fontSize: 12, padding: "3px 9px" }}>{p.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              {send === 0 ? (
                <div className="card-d" style={{ marginTop: 26, maxWidth: 640 }}>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                    {checks.map((c, k) => (
                      <li key={c.title} className="bv-in" style={{ display: "flex", gap: 12, alignItems: "flex-start", animationDelay: `${k * 0.1}s` }}>
                        <span className="avatar" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 14, background: c.ok ? "var(--teal)" : "rgba(243,174,120,0.2)", color: c.ok ? "#fff" : "var(--sand-soft)" }}>
                          {c.ok ? <Check size={14} /> : "!"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                          <div style={{ fontSize: 14, color: "var(--muted)" }}>{c.note}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ol aria-live="polite" style={{ margin: "26px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
                  {SEND_STEPS.map(([title, desc], k) => (
                    <ProgressRow key={title} title={title} desc={desc} state={send > k + 1 || sent ? "done" : send === k + 1 ? "run" : "wait"} />
                  ))}
                </ol>
              )}
              {sent && (
                <div className="bv-in" style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 20px 14px 14px", borderRadius: 999, background: "var(--ivory)", color: "var(--navy)" }}>
                  <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: 40, height: 40 }}>
                    <span className="bv-burst" style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(25,124,120,0.35)" }} />
                    <span className="check-done bv-pop" style={{ position: "relative", width: 40, height: 40 }}>
                      <Check size={18} style={{ color: "#fff" }} />
                    </span>
                  </span>
                  <span style={{ fontWeight: 700 }}>Sent. Report expected by {expected} (sample).</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <p className="card-d" style={{ margin: "26px 0 0", maxWidth: 600, color: "#dce6e2" }}>
              I’ve noted that you skipped it. You’ll find “Request a second opinion” here if you change your mind.
            </p>
          )}

          <div className="actions">
            {step === 0 ? (
              <Link href="/case/records" className="btn btn-outline">Back</Link>
            ) : (
              !sending && (
                <button type="button" className="btn btn-outline" onClick={() => setStep(step === 3 ? 0 : step - 1)}>
                  Back
                </button>
              )
            )}
            {(step === 1 || (step === 2 && send === 0)) && (
              <button type="button" className="btn btn-primary bv-btn" onClick={() => (step === 1 ? setStep(2) : setSend(1))}>
                {step === 1 ? "Continue" : "Send to the panel"}
                <Arrow size={18} />
              </button>
            )}
            {(sent || step === 3) && (
              <Link href="/case/options" className="btn btn-primary bv-btn bv-in">
                Continue to options
                <Arrow size={18} />
              </Link>
            )}
            <StepDots step={Math.min(step, 2)} total={3} />
          </div>
        </AssistantPrompt>
      </section>

      <aside aria-label="Second opinion status" className="panel bv-in" style={{ animationDelay: ".2s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2>Second opinion</h2>
          <span className={`pill ${sent ? "" : "pill-mute"}`} style={{ fontSize: 12, padding: "3px 10px", ...(sent ? { background: "var(--mint)", color: "var(--navy)" } : {}) }}>
            {statusText}
          </span>
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center" }}>
          {panel.map((p, k) => (
            <span key={p.initials} className="avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 12, border: "2px solid var(--navy-2)", marginLeft: k ? -8 : 0, background: p.color }}>
              {p.initials}
            </span>
          ))}
          <span style={{ marginLeft: 12, fontSize: 14, color: "var(--muted)" }}>3 specialists · 1 video call</span>
        </div>
        <dl style={{ margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
          {[["Panel fee (sample)", fee], ["File", files ? `${files} records${translated ? " · translated" : ""}` : "No files yet"], ["Report expected", step === 3 ? "—" : expected]].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <dt style={{ color: "var(--muted)" }}>{a}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{b}</dd>
            </div>
          ))}
        </dl>
        <ol style={{ margin: "20px 0 0", padding: 0, listStyle: "none" }}>
          {SEND_STEPS.map(([title], k) => {
            const done = send > k + 1 || sent;
            const running = send === k + 1;
            const lit = send > 0 && k <= prog;
            return (
              <li key={title} style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flex: "none" }}>
                  <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, transition: "background-color .3s ease", background: done ? "var(--mint)" : running ? "var(--sand)" : "transparent", border: done || running ? 0 : "2px solid rgba(247,244,236,0.3)", boxShadow: running ? "0 0 0 4px rgba(243,174,120,0.25)" : "none" }} />
                  {k < 3 && <span aria-hidden="true" style={{ width: 2, flex: 1, minHeight: 14, background: done ? "var(--mint)" : "rgba(247,244,236,0.15)" }} />}
                </div>
                <div style={{ paddingBottom: 12, fontSize: 14, color: lit ? "var(--ivory)" : "var(--muted)" }}>{title}</div>
              </li>
            );
          })}
        </ol>
        <p className="panel-foot">The panel gives an opinion on the treatment plan. Decisions stay with you and your doctors.</p>
      </aside>
    </main>
  );
}
