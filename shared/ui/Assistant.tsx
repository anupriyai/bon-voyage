"use client";

import { useEffect, useState, type ReactNode } from "react";

export type OrbMode = "idle" | "listen" | "think";

function prefersReduced(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Types `ack` then `title` one character at a time. Restarts whenever either changes. */
export function useTyped(ack: string, title: string) {
  const key = ack + "|" + title;
  const total = ack.length + title.length;
  const [state, setState] = useState({ key, n: 0 });
  const n = state.key === key ? state.n : 0;

  useEffect(() => {
    if (prefersReduced()) {
      setState({ key, n: total });
      return;
    }
    setState({ key, n: 0 });
    const start = performance.now();
    const t = window.setInterval(() => {
      const next = Math.min(total, Math.floor((performance.now() - start) / 14));
      setState({ key, n: next });
      if (next >= total) window.clearInterval(t);
    }, 28);
    return () => window.clearInterval(t);
  }, [key, total]);

  return {
    ackShown: ack.slice(0, Math.min(n, ack.length)),
    titleShown: title.slice(0, Math.max(0, n - ack.length)),
    typing: n < total,
    done: n >= total,
  };
}

export function Orb({ mode = "idle" }: { mode?: OrbMode }) {
  const speed = mode === "think" ? "0.9s" : mode === "listen" ? "2s" : "6s";
  return (
    <span aria-hidden="true" style={{ position: "relative", width: 52, height: 52, flex: "none" }}>
      <span className="bv-halo" style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(111,208,195,0.35)" }} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: "conic-gradient(from 0deg, #197C78, #6FD0C3, #F3AE78, #197C78)",
          animation: `bvSpin ${speed} linear infinite`,
        }}
      />
      <span style={{ position: "absolute", inset: 6, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #2C6274, #142D3B 70%)" }} />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 10,
          height: 10,
          margin: "-5px 0 0 -5px",
          borderRadius: 999,
          background: "#F7F4EC",
          boxShadow: "0 0 14px 3px rgba(111,208,195,0.8)",
        }}
      />
    </span>
  );
}

export function AssistantIdentity({ status, busy, mode }: { status: string; busy?: boolean; mode?: OrbMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
      <Orb mode={mode ?? (busy ? "think" : "idle")} />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
          Bon Voyage assistant{" "}
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "2px 7px",
              borderRadius: 6,
              background: "rgba(111,208,195,0.18)",
              color: "var(--mint-soft)",
            }}
          >
            AI
          </span>
        </div>
        <div aria-live="polite" style={{ fontSize: 14, color: "var(--muted)", display: "flex", alignItems: "center", gap: 2 }}>
          {status}
          {busy && (
            <span aria-hidden="true">
              <span className="bv-dot1">.</span>
              <span className="bv-dot2">.</span>
              <span className="bv-dot3">.</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface PromptProps {
  ack?: string;
  title: string;
  help?: ReactNode;
  status: string;
  busy?: boolean;
  mode?: OrbMode;
  /** Render when typing has finished, so choices appear after the question. */
  children?: ReactNode;
  titleSize?: string;
}

/** The assistant speaking: identity, a typed acknowledgement and question, then the help line and content. */
export function AssistantPrompt({ ack = "", title, help, status, busy, mode, children, titleSize }: PromptProps) {
  const t = useTyped(ack, title);
  return (
    <div>
      <AssistantIdentity status={status} busy={busy} mode={mode} />
      {ack && (
        <p style={{ margin: "0 0 10px", fontSize: 18, color: "var(--mint-soft)", minHeight: "1.5em", maxWidth: "42em" }}>
          <span className="sr-only">{ack}</span>
          <span aria-hidden="true">{t.ackShown}</span>
        </p>
      )}
      <h1
        style={{
          margin: 0,
          fontSize: titleSize ?? "clamp(34px, 3.8vw, 50px)",
          lineHeight: 1.06,
          letterSpacing: "-0.03em",
          fontWeight: 800,
          minHeight: "1.1em",
        }}
      >
        <span className="sr-only">{title}</span>
        <span aria-hidden="true">
          {t.titleShown}
          {t.typing && <span className="bv-caret">|</span>}
        </span>
      </h1>
      {t.done && (
        <>
          {help && (
            <p className="bv-in" style={{ margin: "12px 0 0", fontSize: 18, color: "var(--muted)", maxWidth: "38em" }}>
              {help}
            </p>
          )}
          {children && <div className="bv-in bv-d1">{children}</div>}
        </>
      )}
    </div>
  );
}

/** Step indicator dots ("Step 2 of 3"). */
export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <span className="dots" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ width: i === step ? 26 : 8, background: i <= step ? "var(--mint)" : "rgba(247,244,236,0.2)" }} />
      ))}
    </span>
  );
}

/** Checklist row with a spinner while running and a tick when done (sending, building, paying). */
export function ProgressRow({ title, desc, state }: { title: string; desc?: string; state: "wait" | "run" | "done" }) {
  return (
    <li
      className="check-row"
      style={{ opacity: state === "wait" ? 0.4 : 1, background: state === "wait" ? "transparent" : "rgba(247,244,236,0.06)" }}
    >
      <span aria-hidden="true" className="check-icon">
        {state === "done" && (
          <span className="check-done bv-pop">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        )}
        {state === "run" && <span className="spinner bv-spinner" />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: 14, color: "var(--muted)" }}>{desc}</div>}
      </div>
    </li>
  );
}

/** Advances a counter on a timer, e.g. to reveal checklist rows one by one. Returns [n, start]. */
export function useTicker(max: number, ms: number): [number, () => void] {
  const [n, setN] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const step = prefersReduced() ? 50 : ms;
    const t = window.setInterval(() => {
      setN((v) => {
        if (v + 1 >= max) {
          window.clearInterval(t);
          setRunning(false);
        }
        return Math.min(max, v + 1);
      });
    }, step);
    return () => window.clearInterval(t);
  }, [running, max, ms]);
  return [n, () => {
    setN(1);
    setRunning(true);
  }];
}
