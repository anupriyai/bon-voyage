"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantPrompt, StepDots } from "@/shared/ui/Assistant";
import { Arrow, Check, Sparkle, Upload } from "@/shared/ui/Icons";
import { classifyFile } from "@/domains/case";
import { COORDINATOR, recordsFor, type RecordItem } from "@/domains/case";
import { firstName } from "@/domains/case";
import { itemHandled, useCase, type RecFile } from "@/domains/case";

interface Incoming {
  name: string;
  ext: string;
  size: number;
  itemId: string | null;
  found: string;
  date: string;
  /** Needs translating into English. */
  ar: boolean;
  start: number;
}

type Phase = "queued" | "upload" | "read" | "translate" | "filed";
const UP = 600;
const READ = 900;
const TRANS = 900;

function phaseOf(f: Incoming, t: number): { k: Phase; p: number } {
  const x = t - f.start;
  if (x < 0) return { k: "queued", p: 0 };
  if (x < UP) return { k: "upload", p: x / UP };
  if (x < UP + READ) return { k: "read", p: (x - UP) / READ };
  if (f.ar && x < UP + READ + TRANS) return { k: "translate", p: (x - UP - READ) / TRANS };
  return { k: "filed", p: 1 };
}

const fmtSize = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
const isLabTest = (r: RecordItem) => /existing biopsy/i.test(r.hint ?? "");
const SAMPLE_DATES = ["28 Sep 2026", "10 Sep 2026", "12 Sep 2026", "1 Oct 2026", "1 Oct 2026", "2 Oct 2026", "Photo of boxes", "30 Sep 2026"];

export default function RecordsPage() {
  const { state, update, setIntake, openChat } = useCase();
  const i = state.intake;
  const items = useMemo(() => recordsFor(i.diagnosis), [i.diagnosis]);
  const required = items.filter((r) => !r.optional);
  const patient = firstName(i.patientName) || "the patient";
  const translates = i.languages.length > 0 && !i.languages.includes("english");
  const langName = i.languages.includes("arabic") ? "Arabic" : "the original language";

  const [step, setStep] = useState(0);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [t, setT] = useState(0);
  const [askHealth, setAskHealth] = useState(false);
  const persisted = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);

  const t0 = useRef(0);
  const running = incoming.length > 0 && incoming.some((f) => phaseOf(f, t).k !== "filed");
  useEffect(() => {
    if (!running) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    const iv = window.setInterval(() => setT(reduced ? 1e9 : performance.now() - t0.current), 80);
    return () => window.clearInterval(iv);
  }, [running]);

  // File each record into the case the moment the assistant finishes reading it.
  useEffect(() => {
    const done = incoming.filter((f) => phaseOf(f, t).k === "filed" && !persisted.current.has(f.name + f.start));
    if (!done.length) return;
    done.forEach((f) => persisted.current.add(f.name + f.start));
    update((s) => {
      const records = { ...s.records };
      const unsorted = [...s.unsorted];
      for (const f of done) {
        const file: RecFile = { name: f.name, size: f.size, at: new Date().toISOString(), docDate: f.date, found: f.found, translated: true };
        if (f.itemId) records[f.itemId] = { ...(records[f.itemId] ?? { files: [] }), files: [...(records[f.itemId]?.files ?? []), file] };
        else unsorted.push(file);
      }
      return { ...s, records, unsorted };
    });
  }, [t, incoming, update]);

  const enqueue = (list: Omit<Incoming, "start">[]) => {
    if (!incoming.length) t0.current = performance.now();
    const base = performance.now() - t0.current;
    setIncoming((cur) => [...cur, ...list.map((f, k) => ({ ...f, start: base + k * UP }))]);
  };

  const addSample = () => {
    const pick = required.filter((r) => !r.physical && !isLabTest(r) && !r.id.endsWith(".conditions") && !itemHandled(r.id, state));
    enqueue(
      pick.map((r, k) => {
        const key = r.id.split(".")[1];
        const photo = ["blood", "cea", "meds", "psa"].includes(key);
        return {
          name: `${key === "ct" ? "ct-chest-abdomen-pelvis" : key}-${photo ? "photo.jpg" : "report.pdf"}`,
          ext: photo ? "JPG" : "PDF",
          size: Math.round(300_000 + ((k * 733_211) % 3_900_000)),
          itemId: r.id,
          found: r.title,
          date: SAMPLE_DATES[k % SAMPLE_DATES.length],
          ar: translates && key !== "biopsy",
        };
      }),
    );
  };

  const addReal = (files: FileList | null) => {
    if (!files?.length) return;
    enqueue(
      Array.from(files).map((f) => {
        const guess = classifyFile(f.name);
        const itemId = guess ? items.find((r) => r.id.endsWith(`.${guess.key}`))?.id ?? null : null;
        return {
          name: f.name,
          ext: (f.name.split(".").pop() ?? "FILE").toUpperCase().slice(0, 4),
          size: f.size,
          itemId,
          found: itemId ? items.find((r) => r.id === itemId)!.title : "Unsorted · Hala will check it",
          date: new Date(f.lastModified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          ar: translates,
        };
      }),
    );
  };

  const working = running;
  const filedNow = incoming.filter((f) => phaseOf(f, t).k === "filed").length;
  const allFiled = incoming.length > 0 && !running;
  const existing = Object.values(state.records).reduce((n, r) => n + r.files.length, 0) + state.unsorted.length;
  const translatedCount = incoming.filter((f) => f.ar).length;

  /* ---------- checklist ---------- */
  const groups = useMemo(() => {
    const g = new Map<string, RecordItem[]>();
    for (const r of items) g.set(r.group, [...(g.get(r.group) ?? []), r]);
    return [...g.entries()];
  }, [items]);
  const doneCount = required.filter((r) => itemHandled(r.id, state)).length;
  const pct = Math.round((doneCount / Math.max(1, required.length)) * 100);

  /* ---------- missing items ---------- */
  const missingItems = required.filter((r) => !state.records[r.id]?.files.length && !r.id.endsWith(".conditions"));
  const conditions = required.find((r) => r.id.endsWith(".conditions"));
  const healthDone = Object.keys(state.health).length >= 2;
  const setRecord = (id: string, p: { courier?: boolean; requested?: boolean }) =>
    update((s) => ({ ...s, records: { ...s.records, [id]: { ...(s.records[id] ?? { files: [] }), ...p } } }));

  const actions = [
    ...missingItems.map((r) => {
      const kind = r.physical ? "courier" : isLabTest(r) ? "lab" : "ask";
      const on = kind === "courier" ? !!state.records[r.id]?.courier : !!state.records[r.id]?.requested;
      const copy = {
        courier: ["Physical samples. A medical courier collects them from the lab.", "Arrange a courier", "Courier booked (sample)"],
        lab: [`Done on the existing biopsy. No new procedure for ${patient}.`, "I’ll draft the lab request", `Request drafted for ${firstName(COORDINATOR.name)}`],
        ask: ["Not in the files yet. I can ask the treating doctor’s office for a copy.", "Request it for me", `${firstName(COORDINATOR.name)} will request it`],
      }[kind];
      return {
        id: r.id,
        title: r.title,
        sub: copy[0],
        cta: on ? `✓ ${copy[2]}` : `${copy[1]} →`,
        on,
        toggle: () => setRecord(r.id, kind === "courier" ? { courier: !on } : { requested: !on }),
      };
    }),
    ...(conditions && !state.records[conditions.id]?.files.length
      ? [{ id: conditions.id, title: "Health history", sub: "Two quick questions instead of a document, like diabetes or allergies.", cta: healthDone ? "✓ Added from your answers" : "Answer two questions →", on: healthDone, toggle: () => setAskHealth(!askHealth) }]
      : []),
  ];
  const nHandled = actions.filter((a) => a.on).length;

  /* ---------- prompts ---------- */
  const prompts = [
    {
      ack: existing && !incoming.length ? `Welcome back. ${existing} records are already filed.` : "Your case is ready. Next, the records specialists will need.",
      title: `Let’s gather ${patient}’s records.`,
      help: `Add whatever you have, in any language. Photos of paper reports are fine. I’ll read, sort${translates ? " and translate" : ""} each file, so you never rename anything.`,
    },
    {
      ack: allFiled ? `Done. I filed ${incoming.length} records${translatedCount ? ` and translated ${translatedCount} from ${langName}` : ""}.` : "No problem, you can add files any time.",
      title: actions.length ? `${actions.length === 1 ? "One thing is" : `${["Zero", "One", "Two", "Three", "Four", "Five", "Six"][actions.length] ?? actions.length} things are`} still missing.` : "Everything specialists need is in.",
      help: actions.length ? "I can take care of most of it. Tap what you’d like me to do." : "Nothing is missing from the checklist.",
    },
    { ack: "Thanks. One last thing about records.", title: "Who should be able to see them?", help: "You’re always in control. Hospitals only see files after you approve." },
  ];
  const P = prompts[step];
  const status = step === 0 ? (working ? "Reading your files" : allFiled ? "All files filed" : "Ready when you are") : step === 1 ? "Waiting for your choice" : "Almost done";
  const nextOk = step !== 0 || allFiled || existing > 0;
  const nextLabel = step === 0 ? (nextOk ? "Continue" : working ? "Reading files…" : "Add files to continue") : step === 1 ? (nHandled ? `Continue · ${nHandled} of ${actions.length} handled` : "Continue") : "Continue";

  const mgr = i.forWhom === "self" ? null : firstName(i.managerName) || "You";
  const people = [
    ...(mgr ? [{ initials: mgr.slice(0, 2).toUpperCase(), name: `${mgr} (you)`, note: "Manages the case", bg: "var(--ivory)", lock: "Owner" }] : []),
    { initials: (patient.slice(0, 1) + (i.patientName.split(" ")[1]?.[0] ?? "")).toUpperCase(), name: i.forWhom === "self" ? "You" : patient, note: i.patientSeesAll ? "Can see everything in the case" : "Sees only what you share", bg: "var(--mint)", toggle: i.forWhom !== "self" },
    { initials: COORDINATOR.initials, name: COORDINATOR.name, note: "Your coordinator, needed to arrange care", bg: "var(--sand)", lock: "Always" },
    { initials: "H+", name: "Hospitals", note: "Only the hospital you approve, only when you approve", bg: "rgba(247,244,236,0.15)", lock: "After you approve", light: true },
  ];

  return (
    <main className="wrap flow-main">
      <section aria-label="Assistant" className="flow-section">
        <AssistantPrompt ack={P.ack} title={P.title} help={P.help} status={status} busy={working} mode={working ? "think" : "idle"}>
          {step === 0 && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addReal(e.dataTransfer.files);
                }}
                style={{ marginTop: 24, padding: "28px 24px", borderRadius: 28, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transition: "background-color .4s ease, border-color .4s ease", border: `2px dashed ${working ? "var(--mint)" : "rgba(247,244,236,0.25)"}`, background: working ? "rgba(111,208,195,0.08)" : "rgba(247,244,236,0.04)" }}
              >
                <div aria-hidden="true" className="bv-bob" style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(111,208,195,0.16)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Upload size={28} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Drop files here</div>
                <div style={{ fontSize: 15, color: "var(--muted)" }}>PDFs, photos or scans · up to 50 at once</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
                  <button type="button" className="btn btn-primary bv-btn" onClick={addSample} aria-disabled={working}>
                    <Sparkle size={16} />
                    {incoming.length ? (allFiled ? "Sample files added" : "Reading files…") : "Add sample files"}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
                    Choose files
                  </button>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => addReal(e.target.files)} />
                </div>
              </div>
              {incoming.length > 0 && (
                <ul aria-live="polite" style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 8 }}>
                  {incoming.map((f, k) => {
                    const p = phaseOf(f, t);
                    const m = {
                      queued: ["Waiting", "pill-mute", f.name, fmtSize(f.size)],
                      upload: ["Uploading", "pill-mute", f.name, `${fmtSize(f.size)} · ${Math.round(p.p * 100)}%`],
                      read: ["AI reading", "pill-wait", f.name, "Finding the document type and date…"],
                      translate: ["Translating", "pill-wait", f.found, `${langName} → English · ${Math.round(p.p * 100)}%`],
                      filed: ["Filed", "pill-ok", f.found, `${f.date}${f.ar ? " · translated" : ""}`],
                    }[p.k];
                    return (
                      <li key={f.name + f.start} className="bv-in" style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 16, background: "rgba(247,244,236,0.05)", border: `1px solid ${p.k === "filed" ? "rgba(111,208,195,0.35)" : "rgba(247,244,236,0.1)"}`, animationDelay: `${k * 0.06}s` }}>
                        <span aria-hidden="true" style={{ position: "relative", width: 38, height: 46, flex: "none", borderRadius: 9, color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, overflow: "hidden", background: f.ext === "PDF" ? "#C85A3C" : "#3C7FA6" }}>
                          {f.ext}
                          {p.k === "read" && <span className="bv-scan" style={{ position: "absolute", left: 0, right: 0, height: 3, background: "var(--sand)", boxShadow: "0 0 10px 2px rgba(243,174,120,0.8)" }} />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m[2]}</span>
                            <span className={`pill ${m[1]}`}>{m[0]}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m[3]}</div>
                          <div aria-hidden="true" style={{ marginTop: 6, height: 4, borderRadius: 999, background: "rgba(247,244,236,0.1)", overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", borderRadius: 999, width: `${Math.round((p.k === "filed" ? 1 : p.k === "queued" ? 0 : p.p) * 100)}%`, background: p.k === "filed" ? "var(--mint)" : p.k === "upload" ? "var(--ivory)" : "var(--sand)" }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filedNow > 0 && state.unsorted.length > 0 && (
                <p style={{ margin: "12px 0 0", fontSize: 15, color: "var(--muted)" }}>
                  {state.unsorted.length} file{state.unsorted.length > 1 ? "s" : ""} I couldn’t place yet. {firstName(COORDINATOR.name)} will sort {state.unsorted.length > 1 ? "them" : "it"}.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {actions.map((a, k) => (
                  <button key={a.id} type="button" className={`tile bv-tile bv-in${a.on ? " is-on" : ""}`} onClick={a.toggle} aria-pressed={a.on} style={{ gap: 6, padding: 18, borderRadius: 20, minHeight: 150, animationDelay: `${k * 0.08}s` }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%" }}>
                      <span style={{ fontSize: 17, fontWeight: 700 }}>{a.title}</span>
                      {a.on && <span className="badge bv-pop"><Check size={13} /></span>}
                    </span>
                    <span className="sub" style={{ fontSize: 15 }}>{a.sub}</span>
                    <span style={{ marginTop: "auto", fontSize: 14, fontWeight: 700, color: a.on ? "var(--teal-ink)" : "var(--mint-soft)" }}>{a.cta}</span>
                  </button>
                ))}
              </div>
              {askHealth && !healthDone && (
                <div className="card-d bv-in" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    ["conditions", `Does ${patient} have other long-term conditions?`, ["Diabetes", "Heart condition", "Something else", "None"]],
                    ["allergies", "Any allergies to medicines?", ["Yes", "No", "Not sure"]],
                  ].map(([key, q, opts]) => (
                    <div key={key as string}>
                      <div style={{ fontWeight: 700 }}>{q as string}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {(opts as string[]).map((o) => {
                          const on = state.health[key as string] === o;
                          return (
                            <button key={o} type="button" aria-pressed={on} onClick={() => update((s) => ({ ...s, health: { ...s.health, [key as string]: o } }))} className="bv-chip" style={{ minHeight: 42, padding: "0 16px", borderRadius: 999, cursor: "pointer", fontWeight: 600, background: on ? "var(--ivory)" : "transparent", color: on ? "var(--navy)" : "var(--ivory)", border: `1.5px solid ${on ? "var(--ivory)" : "rgba(247,244,236,0.22)"}` }}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {items.some((r) => r.optional) && (
                <p style={{ margin: "14px 0 0", fontSize: 15, color: "var(--muted)" }}>
                  {items.filter((r) => r.optional).map((r) => r.title).join(" and ")} {items.filter((r) => r.optional).length > 1 ? "are" : "is"} optional. The specialists will say if they need it.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
              {people.map((p, k) => (
                <li key={p.name} className="bv-in" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 18, background: "rgba(247,244,236,0.05)", border: "1px solid rgba(247,244,236,0.12)", animationDelay: `${k * 0.08}s` }}>
                  <span className="avatar" aria-hidden="true" style={{ width: 44, height: 44, fontSize: 14, background: p.bg, color: p.light ? "var(--ivory)" : "var(--navy)" }}>
                    {p.initials}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 14, color: "var(--muted)" }}>{p.note}</div>
                  </div>
                  {p.toggle ? (
                    <button type="button" role="switch" aria-checked={i.patientSeesAll} aria-label={`Let ${p.name} see everything`} onClick={() => setIntake({ patientSeesAll: !i.patientSeesAll })} style={{ position: "relative", width: 52, height: 30, flex: "none", borderRadius: 999, border: 0, cursor: "pointer", transition: "background-color .25s ease", background: i.patientSeesAll ? "var(--teal)" : "rgba(247,244,236,0.2)" }}>
                      <span style={{ position: "absolute", top: 3, left: i.patientSeesAll ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left .25s cubic-bezier(.2,.7,.2,1)" }} />
                    </button>
                  ) : (
                    <span className="pill pill-mute" style={{ fontSize: 12, padding: "4px 10px" }}>{p.lock}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="actions">
            {step === 0 ? (
              <Link href="/start?edit=1" className="btn btn-outline">Back</Link>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {step < 2 ? (
              <button type="button" className="btn btn-primary bv-btn" onClick={() => nextOk && setStep(step + 1)} aria-disabled={!nextOk}>
                {nextLabel}
                <Arrow size={18} />
              </button>
            ) : (
              <Link href="/case/second-opinion" className="btn btn-primary bv-btn">
                Save and continue to second opinion
                <Arrow size={18} />
              </Link>
            )}
            {step === 0 && !nextOk && (
              <button type="button" className="link-btn" onClick={() => setStep(1)}>I’ll add them later</button>
            )}
            {step === 1 && (
              <button type="button" className="link-btn" onClick={() => openChat(`I have a question about ${patient}’s records.`)}>Ask {firstName(COORDINATOR.name)}</button>
            )}
            <StepDots step={step} total={3} />
          </div>
        </AssistantPrompt>
      </section>

      <aside aria-label="Records checklist" className="panel bv-in" style={{ animationDelay: ".2s" }}>
        <div className="eyebrow" style={{ color: "var(--sand)" }}>{i.forWhom === "self" ? "Your case" : `${patient}’s case`}</div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>
          {[i.stage && i.stage !== "unsure" ? `Stage ${i.stage}` : null, i.diagnosis ? caseDx(i.diagnosis) : null, i.originCity].filter(Boolean).join(" · ")}
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="78" height="78" viewBox="0 0 84 84" role="img" aria-label={`Records ${pct} percent complete`} style={{ flex: "none" }}>
            <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(247,244,236,0.12)" strokeWidth="8" />
            <circle cx="42" cy="42" r="34" fill="none" stroke="#6FD0C3" strokeWidth="8" strokeLinecap="round" strokeDasharray="213.6" transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)", strokeDashoffset: 213.6 * (1 - pct / 100) }} />
            <text x="42" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill="#F7F4EC">{pct}%</text>
          </svg>
          <div>
            <h2>Records checklist</h2>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>
              {doneCount} of {required.length} needed{items.length > required.length ? ` · ${items.length - required.length} optional` : ""}
            </div>
          </div>
        </div>
        {groups.map(([g, list]) => (
          <div key={g} style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ fontSize: 11, color: "var(--muted-2)" }}>{g}</div>
            <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
              {list.map((r) => {
                const d = itemHandled(r.id, state);
                return (
                  <li key={`${r.id}${d}`} className={d ? "bv-flash" : ""} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 8px", borderRadius: 10 }}>
                    <span aria-hidden="true" style={{ width: 18, height: 18, flex: "none", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: d ? "var(--mint)" : "transparent", border: d ? 0 : `2px ${r.optional ? "dashed" : "solid"} rgba(247,244,236,0.3)` }}>
                      {d && <Check size={11} strokeWidth={3.6} style={{ color: "var(--navy)" }} className="bv-pop" />}
                    </span>
                    <span style={{ fontSize: 14, flex: 1, minWidth: 0, color: d ? "var(--ivory)" : "var(--muted)" }}>
                      {r.title}
                      {r.optional ? " (optional)" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="panel-foot">
          Private to you{i.forWhom === "self" ? "" : `, ${patient}`} and {firstName(COORDINATOR.name)}. Sample files only in this prototype.
        </p>
      </aside>
    </main>
  );
}

function caseDx(dx: string): string {
  return { colon: "colon cancer", breast: "breast cancer", prostate: "prostate cancer", lung: "lung cancer", other: "cancer" }[dx] ?? "";
}
