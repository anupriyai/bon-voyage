"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DX_INFO, ORIGIN_BY_ID, COORDINATOR } from "@/domains/case/data/catalogue";
import { firstName } from "@/domains/case/model/engine";
import { useCase } from "@/domains/case/state/store";
import CurrencyMenu from "@/shared/ui/CurrencyMenu";
import { Check, Close, Logo, Sparkle } from "@/shared/ui/Icons";

export const PHASES = [
  { label: "Your story", href: "/start?edit=1" },
  { label: "Records", href: "/case/records" },
  { label: "Second opinion", href: "/case/second-opinion" },
  { label: "Options", href: "/case/options" },
  { label: "Flights", href: "/case/flights" },
  { label: "Stay", href: "/case/stays" },
  { label: "Plan", href: "/case/plan" },
  { label: "Ready to travel", href: "/case/dashboard" },
];

const STAGE_LINE = [
  "telling the story",
  "adding records",
  "requesting a second opinion",
  "comparing options",
  "comparing flights",
  "comparing stays",
  "reviewing the plan",
  "getting ready to travel",
];

export function PhaseList({ active, sub = "", links = true }: { active: number; sub?: string; links?: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  // On narrow screens the strip scrolls sideways; keep the current step in view.
  useEffect(() => {
    const ol = list.current;
    const cur = ol?.querySelector<HTMLElement>("[data-current]");
    if (ol && cur && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = cur.offsetLeft - ol.offsetLeft - 16;
  }, [active]);
  return (
    <nav aria-label="Journey progress" style={{ margin: "0 auto", minWidth: 0 }}>
      <ol ref={list} className="phases">
        {PHASES.map((p, i) => {
          const style = {
            fontWeight: i === active ? 700 : 500,
            color: i <= active ? "var(--navy)" : "var(--muted-2)",
            background: i === active ? "rgba(20,45,59,0.08)" : "transparent",
          };
          const inner = (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  flex: "none",
                  background: i < active ? "var(--mint)" : i === active ? "var(--sand)" : "rgba(20,45,59,0.22)",
                  boxShadow: i === active ? "0 0 0 4px rgba(243,174,120,0.22)" : "none",
                }}
              />
              {p.label}
              {i === active && sub}
              <span className="sr-only">{i === active ? " (current step)" : i < active ? " (done)" : ""}</span>
            </>
          );
          return (
            <li key={p.label} data-current={i === active ? "" : undefined} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {links && i <= active + 1 ? (
                <Link href={p.href} className="phase-link" aria-current={i === active ? "step" : undefined} style={style}>
                  {inner}
                </Link>
              ) : (
                <span className="phase-link" style={style}>
                  {inner}
                </span>
              )}
              {i < PHASES.length - 1 && (
                <span aria-hidden="true" className="phase-gap">
                  <span style={{ display: "block", height: "100%", background: "var(--mint)", width: i < active ? "100%" : "0%" }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="brand">
      <Logo />
      <span>Bon Voyage</span>
    </Link>
  );
}

/** Top bar for every step after the story: progress, autosave, currency and the coordinator. */
export default function JourneyBar({ active }: { active: number }) {
  const { openChat, state, saveStatus, saveNow, reloadCases } = useCase();
  const unread = state.chat.length > 0 && state.chat[state.chat.length - 1].from === "coordinator";
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Brand />
        <PhaseList active={active} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="hide-md" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--muted)" }}>
            <Check size={15} style={{ color: "var(--mint)" }} />
            <span role="status">{state.sample ? "Sample · on this device" : saveStatus === "saved" ? "Saved to account" : saveStatus === "saving" ? "Saving…" : saveStatus === "conflict" ? "Changed on another device" : saveStatus === "error" ? "Save unavailable" : "On this device"}</span>
            {saveStatus === "error" && <button type="button" className="link-btn" onClick={() => { void saveNow().catch(() => {}); }}>Retry</button>}
            {(saveStatus === "conflict" || saveStatus === "error") && <button type="button" className="link-btn" onClick={() => { if (window.confirm("Reload saved cases? Unsaved changes will be replaced.")) reloadCases(); }}>Reload</button>}
          </span>
          <CurrencyMenu />
          <button
            type="button"
            className="pill-btn"
            onClick={() => openChat()}
            aria-label={`Message ${firstName(COORDINATOR.name)}, your coordinator`}
            style={{ padding: "0 14px 0 5px", background: "rgba(20,45,59,0.06)" }}
          >
            <span className="avatar" aria-hidden="true" style={{ position: "relative", width: 32, height: 32, background: "var(--sand)", fontSize: 13 }}>
              {COORDINATOR.initials}
              {unread && (
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "var(--mint)",
                    border: "2px solid var(--navy)",
                  }}
                />
              )}
            </span>
            {firstName(COORDINATOR.name)}
          </button>
        </div>
      </div>
      <CoordinatorDrawer stage={STAGE_LINE[active] ?? ""} />
    </header>
  );
}

const PRIORITY_WORD = { experience: "experience", language: "language", cost: "cost", family: "near family", speed: "speed" } as const;

const QUICK = ["Can we start sooner?", "Can my brother come too?", "What does the deposit cover?"];

/** Message the coordinator with an AI-drafted brief attached, so the family never repeats themselves. */
export function CoordinatorDrawer({ stage }: { stage: string }) {
  const { state, chatOpen, chatDraft, closeChat, sendChat } = useCase();
  const [msg, setMsg] = useState(chatDraft);
  const [sent, setSent] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const i = state.intake;
  const hala = firstName(COORDINATOR.name);

  useEffect(() => {
    if (chatOpen) {
      setMsg(chatDraft);
      setSent(false);
    }
  }, [chatOpen, chatDraft]);
  useEffect(() => {
    if (!chatOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = dialog.current;
    const overflow = document.body.style.overflow;
    panel?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      panel?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [chatOpen]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [state.chat.length, chatOpen]);

  if (!chatOpen) return null;
  const dx = i.diagnosis ? DX_INFO[i.diagnosis].name : "";
  const origin = i.origin ? (i.originCity ? `${i.originCity}, ${ORIGIN_BY_ID[i.origin].label}` : ORIGIN_BY_ID[i.origin].label) : "";
  const caseLine = [
    [firstName(i.patientName), i.age].filter(Boolean).join(", "),
    i.stage && i.stage !== "unsure" ? `stage ${i.stage} ${dx}` : dx,
    origin,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
      <dialog ref={dialog} aria-label={`Message ${COORDINATOR.name}`} className="drawer" onCancel={(event) => { event.preventDefault(); closeChat(); }} onClick={(event) => { if (event.target === dialog.current) closeChat(); }}>
        <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(20,45,59,0.1)" }}>
          <span className="avatar" aria-hidden="true" style={{ width: 48, height: 48, background: "var(--sand)" }}>
            {COORDINATOR.initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 18 }}>{COORDINATOR.name}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Care coordinator · Arabic and English · replies within 2 hours</div>
          </div>
          <button
            type="button"
            onClick={closeChat}
            aria-label="Close"
            style={{ marginLeft: "auto", width: 44, height: 44, borderRadius: 999, border: 0, background: "rgba(20,45,59,0.1)", color: "var(--navy)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}
          >
            <Close />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {state.chat.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {state.chat.map((m, k) => (
                <li
                  key={k}
                  className="bv-in"
                  style={{
                    alignSelf: m.from === "you" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "10px 14px",
                    borderRadius: 16,
                    fontSize: 15,
                    background: m.from === "you" ? "var(--sage)" : "rgba(20,45,59,0.08)",
                  }}
                >
                  {m.text}
                </li>
              ))}
            </ul>
          )}
          {sent ? (
            <div className="bv-in" style={{ textAlign: "center", padding: "20px 10px" }}>
              <span className="avatar bv-pop" aria-hidden="true" style={{ width: 56, height: 56, background: "var(--teal)", color: "#fff" }}>
                <Check size={26} />
              </span>
              <h2 style={{ margin: "14px 0 0", fontSize: 22 }}>Sent to {hala}</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                She has your brief, so you won’t need to repeat anything. She usually replies within 2 hours (sample).
              </p>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={() => setSent(false)}>
                Write another message
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: 16, borderRadius: 18, background: "rgba(20,45,59,0.06)", border: "1px solid rgba(20,45,59,0.12)" }}>
                <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--teal-ink)", letterSpacing: "0.08em" }}>
                  <Sparkle size={14} />
                  Brief {hala} will see · AI draft
                </div>
                <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: "var(--ink-soft)" }}>
                  {caseLine && (
                    <li>
                      <strong style={{ color: "var(--navy)" }}>Case:</strong> {caseLine}
                    </li>
                  )}
                  <li>
                    <strong style={{ color: "var(--navy)" }}>Priorities:</strong>{" "}
                    {i.priorities.map((p) => PRIORITY_WORD[p]).join(" → ")}
                  </li>
                  {stage && (
                    <li>
                      <strong style={{ color: "var(--navy)" }}>Where you are:</strong> {stage}
                    </li>
                  )}
                </ul>
                <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>You review this before it’s sent. Nothing goes to a hospital from here.</p>
              </div>
              <label className="label" style={{ color: "var(--navy)", fontWeight: 500 }}>
                Your message
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={4}
                  placeholder="Ask anything, in Arabic or English"
                  style={{ borderRadius: 16, border: "1.5px solid rgba(20,45,59,0.2)", background: "rgba(20,45,59,0.06)", font: "inherit", fontSize: 16, fontWeight: 400, padding: "12px 14px", resize: "vertical", color: "var(--navy)" }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK.map((q) => (
                  <button key={q} type="button" className="bv-chip" onClick={() => setMsg(q)} style={{ minHeight: 40, padding: "6px 12px", borderRadius: 999, border: "1.5px solid rgba(20,45,59,0.18)", background: "transparent", color: "var(--navy)", fontSize: 14, cursor: "pointer" }}>
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                aria-disabled={!msg.trim()}
                onClick={() => {
                  if (!msg.trim()) return;
                  sendChat(msg);
                  setMsg("");
                  setSent(true);
                }}
              >
                Send to {hala} with this brief
              </button>
            </>
          )}
          <div ref={end} />
        </div>
      </dialog>
  );
}
