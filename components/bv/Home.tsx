"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCurrency } from "@/lib/currency";
import { useCase } from "@/lib/store";
import CurrencyMenu from "./CurrencyMenu";
import Globe, { type GlobeRoute } from "./Globe";
import { Arrow, Bed, Car, Care, Check, Close, Logo, Menu, PauseIcon, Person, Plane, PlayIcon, Plus, Sparkle } from "./icons";

type StepKind = "flight" | "transfer" | "stay" | "care" | "return";

interface Dest {
  city: string;
  country: string;
  continent: string;
  from: string;
  fromCode: string;
  toCode: string;
  geo: [[number, number], [number, number]];
  treatment: string;
  dates: string;
  nights: number;
  travellers: string;
  care: number;
  flights: number;
  stay: number;
  transfers: number;
  coord: [string, string, string];
  why: string;
  steps: [StepKind, string, string, string][];
}

// Fictional sample journeys for the hero. Providers, people and prices are illustrative.
const DESTS: Dest[] = [
  { city: "Lima", country: "Peru", continent: "South America", from: "Houston", fromCode: "IAH", toCode: "LIM", geo: [[-95.37, 29.76], [-77.04, -12.05]], treatment: "Dental implants", dates: "Mar 3 – 14, 2027", nights: 11, travellers: "1 traveller", care: 3900, flights: 780, stay: 1045, transfers: 120,
    coord: ["Lucía Paredes", "LP", "English · Spanish"],
    why: "Your stay in Miraflores is 8 minutes from the clinic, so all three visits need only short transfers.",
    steps: [["flight", "Flight out", "IAH → LIM · Wed, Mar 3", "Proposed"], ["transfer", "Airport transfer", "Driver meets you at arrivals", "Proposed"], ["stay", "Apartment-hotel", "Miraflores · 11 nights · 8 min to clinic", "Proposed"], ["care", "Clinic visits", "Consult Mar 4 · Procedure Mar 5 · Check Mar 12", "Clinician review"], ["return", "Return flight", "LIM → IAH · Sun, Mar 14", "After sign-off"]] },
  { city: "Guadalajara", country: "Mexico", continent: "North America", from: "Vancouver", fromCode: "YVR", toCode: "GDL", geo: [[-123.12, 49.28], [-103.35, 20.67]], treatment: "Knee arthroscopy", dates: "Apr 8 – 20, 2027", nights: 12, travellers: "1 traveller", care: 7200, flights: 500, stay: 1020, transfers: 140,
    coord: ["Diego Ramírez", "DR", "English · Spanish"],
    why: "Lower cost matters most to you, so we proposed a suite with a kitchenette instead of a full-service hotel.",
    steps: [["flight", "Flight out", "YVR → GDL · Thu, Apr 8", "Proposed"], ["transfer", "Transfers", "Step-in vehicle for after the procedure", "Proposed"], ["stay", "Suites", "Providencia · 12 nights · 5 min to clinic", "Proposed"], ["care", "Clinic visits", "Consult Apr 9 · Procedure Apr 12 · Follow-up Apr 19", "Surgeon review"], ["return", "Return flight", "GDL → YVR · Tue, Apr 20", "After sign-off"]] },
  { city: "Lisbon", country: "Portugal", continent: "Europe", from: "New York", fromCode: "JFK", toCode: "LIS", geo: [[-73.94, 40.67], [-9.14, 38.72]], treatment: "Hip replacement", dates: "May 10 – 26, 2027", nights: 16, travellers: "1 traveller", care: 13200, flights: 980, stay: 2240, transfers: 220,
    coord: ["Inês Carvalho", "IC", "English · Portuguese"],
    why: "You mentioned stairs are difficult, so we chose a step-free hotel with a lift and an accessible vehicle.",
    steps: [["flight", "Flight out", "JFK → LIS · Mon, May 10", "Proposed"], ["transfer", "Accessible transfers", "Airport, hospital and physio visits", "Proposed"], ["stay", "Step-free hotel", "Saldanha · 16 nights · 6 min to hospital", "Proposed"], ["care", "Hospital and physio", "Pre-op May 11 · Surgery May 13 · Physio from May 15", "Surgeon review"], ["return", "Return flight", "Date set by your surgeon", "After sign-off"]] },
  { city: "Bangkok", country: "Thailand", continent: "Asia", from: "Sydney", fromCode: "SYD", toCode: "BKK", geo: [[151.21, -33.87], [100.5, 13.76]], treatment: "Health screening", dates: "Jun 7 – 12, 2027", nights: 5, travellers: "1 traveller", care: 1250, flights: 750, stay: 460, transfers: 60,
    coord: ["Niran Chaiyaporn", "NC", "English · Thai"],
    why: "Your screening starts early on day two, so we kept your arrival before 6 pm and your first evening free.",
    steps: [["flight", "Flight out", "SYD → BKK · Mon, Jun 7", "Proposed"], ["transfer", "Airport transfer", "Driver meets you at arrivals", "Proposed"], ["stay", "Serviced apartment", "Sukhumvit · 5 nights · 10 min to hospital", "Proposed"], ["care", "Screening", "Screening Jun 8 · Results review Jun 10", "Clinic to confirm"], ["return", "Return flight", "BKK → SYD · Sat, Jun 12", "Proposed"]] },
  { city: "Cape Town", country: "South Africa", continent: "Africa", from: "Nairobi", fromCode: "NBO", toCode: "CPT", geo: [[36.82, -1.29], [18.42, -33.92]], treatment: "Laser eye surgery", dates: "Feb 15 – 21, 2027", nights: 6, travellers: "1 traveller", care: 2400, flights: 620, stay: 720, transfers: 80,
    coord: ["Thandi Mokoena", "TM", "English · isiZulu"],
    why: "You won’t be able to drive right after the procedure, so a driver is included for every clinic day.",
    steps: [["flight", "Flight out", "NBO → CPT · Mon, Feb 15", "Proposed"], ["transfer", "Driver on clinic days", "No driving needed after surgery", "Proposed"], ["stay", "Guesthouse", "Green Point · 6 nights · 12 min to clinic", "Proposed"], ["care", "Clinic visits", "Assessment Feb 16 · Procedure Feb 17 · Check Feb 20", "Clinician review"], ["return", "Return flight", "CPT → NBO · Sun, Feb 21", "After sign-off"]] },
  { city: "Gold Coast", country: "Australia", continent: "Oceania", from: "Singapore", fromCode: "SIN", toCode: "OOL", geo: [[103.82, 1.35], [153.4, -28.02]], treatment: "Fertility treatment", dates: "Aug 2 – 16, 2027", nights: 14, travellers: "2 travellers", care: 10200, flights: 1120, stay: 1550, transfers: 90,
    coord: ["Mia Thompson", "MT", "English"],
    why: "Your partner is travelling with you, so we proposed a one-bedroom apartment and two-seat transfers.",
    steps: [["flight", "Flights for two", "SIN → OOL · Mon, Aug 2", "Proposed"], ["transfer", "Transfers for two", "Airport and clinic visits", "Proposed"], ["stay", "Apartment", "Southport · 14 nights · one bedroom", "Proposed"], ["care", "Clinic visits", "Consult Aug 3 · Monitoring · Procedure date set by clinic", "Timing by clinic"], ["return", "Return flights", "OOL → SIN · Mon, Aug 16", "After sign-off"]] },
];

const ROUTES: GlobeRoute[] = DESTS.map((d) => ({ a: d.geo[0], b: d.geo[1], aLabel: d.from, bLabel: d.city }));

const FAQ: [string, string][] = [
  ["What does Bon Voyage coordinate?", "Care appointments, flights, accommodation, airport and clinic transfers, companion arrangements and document preparation—kept in one plan that updates together when something changes."],
  ["How does the AI assistant help?", "You describe the situation in your own words and the assistant picks out the details, asks only what’s missing, compares options and drafts changes. Every suggestion is labelled as a draft, and nothing happens until you approve it."],
  ["How reliable are the cost estimates?", "Early figures are estimates based on your preferences and sample pricing. Each item stays marked as an estimate until a provider or your coordinator confirms a quote, and any currency conversion is labeled as illustrative."],
  ["Can I talk to a real person?", "Yes. A named coordinator supports your journey. When you reach out, they receive a short summary of your preferences, plan and open questions—which you review before it’s shared."],
  ["Do you give medical advice?", "No. Bon Voyage helps you organize and compare options. Decisions about treatment, timing and recovery are made by licensed clinicians."],
];

const MARQUEE = ["Clinic appointments", "Flights", "Accommodation", "Airport and clinic transfers", "Companion plans", "Documents and entry checklist", "Recovery requirements", "A named coordinator"];

const STEP_ICON: Record<StepKind, React.ReactNode> = {
  flight: <Plane size={19} />,
  return: <Plane size={19} style={{ transform: "scaleX(-1)" }} />,
  transfer: <Car size={19} />,
  stay: <Bed size={19} />,
  care: <Care size={19} />,
};

const btnPrimary: CSSProperties = { fontSize: 18, minHeight: 56, padding: "15px 28px" };

export default function Home() {
  const { money, cur } = useCurrency();
  const { session, myCases } = useCase();
  const [dest, setDest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [swap, setSwap] = useState(0);
  const [faq, setFaq] = useState(0);
  const [menu, setMenu] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!paused)
      timer.current = window.setTimeout(() => {
        setDest((d) => (d + 1) % DESTS.length);
        setSwap((s) => s + 1);
      }, 6500);
    return () => window.clearTimeout(timer.current);
  }, [dest, paused]);

  const pick = (i: number) => {
    if (i !== dest) {
      setDest(i);
      setSwap((s) => s + 1);
    }
    setPaused(true);
  };

  const d = DESTS[dest];
  const parts: [string, number, string][] = [
    ["Care", d.care, "#197C78"],
    [d.travellers === "2 travellers" ? "Flights ×2" : "Flights", d.flights, "#142D3B"],
    [`Stay · ${d.nights} nights`, d.stay, "#9CC9B9"],
    ["Transfers", d.transfers, "#F3AE78"],
  ];
  const total = parts.reduce((s, p) => s + p[1], 0);
  const signedIn = !!session && myCases.length > 0;
  const loginHref = signedIn ? "/account" : "/login";
  const loginLabel = signedIn ? "My journey" : "Log in";

  return (
    <div className="home" style={{ minHeight: "100vh" }}>
      {/* ===== HERO ===== */}
      <div style={{ position: "relative", background: "var(--navy)", color: "var(--ivory)", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", right: "-10%", top: "-10%", width: "70%", height: "120%", background: "radial-gradient(closest-side, rgba(25,124,120,0.42), rgba(25,124,120,0) 70%)" }} />
        <header style={{ position: "relative", zIndex: 3 }}>
          <nav aria-label="Main" className="wrap" style={{ maxWidth: 1240, paddingTop: 22, paddingBottom: 22, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <a href="#top" className="brand">
              <Logo size={34} />
              <span style={{ fontSize: 21 }}>Bon Voyage</span>
            </a>
            <div className="nav-links">
              <a href="#how">How it works</a>
              <a href="#why">Why Bon Voyage</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="nav-cta-desktop" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <CurrencyMenu note="Sample exchange rates for illustration. Your coordinator confirms real quotes." />
              <Link href={loginHref} className="pill-btn bv-ghost" style={{ padding: "10px 18px" }}>
                {loginLabel}
              </Link>
              <Link href="/start" className="btn btn-primary bv-btn" style={{ minHeight: 44, padding: "10px 20px", fontWeight: 600 }}>
                Start my journey
              </Link>
            </div>
            <button type="button" className="pill-btn nav-burger" aria-expanded={menu} aria-label="Menu" onClick={() => setMenu(!menu)} style={{ width: 44, padding: 0, justifyContent: "center" }}>
              {menu ? <Close size={20} /> : <Menu size={20} />}
            </button>
            {menu && (
              <div className="bv-menu" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 20, background: "rgba(247,244,236,0.06)", border: "1px solid rgba(247,244,236,0.14)" }}>
                {[["#how", "How it works"], ["#why", "Why Bon Voyage"], ["#faq", "FAQ"]].map(([h, l]) => (
                  <a key={h} href={h} onClick={() => setMenu(false)} style={{ color: "var(--ivory)", textDecoration: "none", fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" }}>
                    {l}
                  </a>
                ))}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <CurrencyMenu />
                  <Link href={loginHref} className="pill-btn">
                    {loginLabel}
                  </Link>
                </div>
              </div>
            )}
          </nav>
        </header>

        <section id="top" className="wrap" style={{ position: "relative", zIndex: 1, maxWidth: 1240, paddingTop: 40, paddingBottom: 230, display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            <h1 className="bv-in-lg" style={{ margin: 0, fontSize: "clamp(48px, 6.6vw, 96px)", lineHeight: 0.98, letterSpacing: "-0.035em", fontWeight: 800 }}>
              Your care journey,{" "}
              <span style={{ position: "relative", display: "inline-block", color: "var(--mint)" }}>
                connected.
                <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", left: 0, bottom: -14, width: "100%", height: 22, overflow: "visible" }}>
                  <path d="M4 30 C 90 6, 200 4, 396 22" fill="none" stroke="#F3AE78" strokeWidth="5" strokeLinecap="round" strokeDasharray="420" style={{ animation: "bvUnderline 1.4s .7s cubic-bezier(.3,.6,.2,1) both" }} />
                </svg>
              </span>
            </h1>
            <p className="bv-in-lg bv-d1" style={{ margin: "36px 0 0", fontSize: 21, lineHeight: 1.5, color: "#C3D1CD", maxWidth: "29em" }}>
              Explore care abroad with a plan shaped around you—from understanding your options to coordinating travel and the next steps.
            </p>
            <div className="bv-in-lg bv-d2" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 36 }}>
              <Link href="/start" className="btn btn-primary bv-btn" style={btnPrimary}>
                Start my journey
                <Arrow size={20} className="bv-arrow" />
              </Link>
              <Link href={loginHref} className="btn btn-outline bv-ghost" style={{ ...btnPrimary, borderColor: "rgba(247,244,236,0.3)" }}>
                {loginLabel}
              </Link>
            </div>
            <ul className="bv-in-lg bv-d3" style={{ margin: "40px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "10px 24px", color: "#C3D1CD", fontSize: 15 }}>
              {["Tell it in your own words", "Estimates clearly labeled", "A named coordinator"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Check size={18} style={{ color: "var(--mint)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bv-in-lg bv-d2" style={{ flex: "1 1 420px", minWidth: 0, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 640 }}>
              <Globe routes={ROUTES} active={dest} onPick={pick} />
            </div>
          </div>
        </section>
      </div>

      {/* ===== SAMPLE JOURNEY CARD ===== */}
      <div className="wrap" style={{ position: "relative", zIndex: 2, maxWidth: 1240, marginTop: -170 }}>
        <section aria-label="Sample connected journey" className="bv-in-lg bv-d4" style={{ background: "#fff", borderRadius: 28, boxShadow: "0 50px 90px -40px rgba(8,22,30,0.5), 0 0 0 1px rgba(20,45,59,0.06)", padding: "clamp(20px, 3vw, 32px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: "1 1 360px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="bv-ring" style={{ width: 9, height: 9, borderRadius: 999, background: "var(--sand)", display: "inline-block" }} />
                <span className="h-kicker" style={{ fontSize: 13, letterSpacing: "0.08em" }}>Sample journey · {d.continent}</span>
              </div>
              <div key={swap} className="bv-swap">
                <h2 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
                  {d.treatment} in {d.city}, {d.country}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 15, color: "var(--ink-mute)" }}>
                  {d.dates} · {d.nights} nights · {d.travellers} · fictional providers
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div role="group" aria-label="Choose a sample journey" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DESTS.map((x, i) => {
                  const on = i === dest;
                  return (
                    <button
                      key={x.city}
                      type="button"
                      onClick={() => pick(i)}
                      aria-pressed={on}
                      style={{ position: "relative", minHeight: 44, padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", background: on ? "var(--navy)" : "#fff", color: on ? "var(--ivory)" : "var(--navy)", border: `1.5px solid ${on ? "var(--navy)" : "rgba(20,45,59,0.16)"}` }}
                    >
                      {x.city}
                      {on && !paused && (
                        <span key={swap} aria-hidden="true" style={{ position: "absolute", left: 12, right: 12, bottom: 6, height: 2, borderRadius: 2, background: "var(--sand)", transformOrigin: "left", animation: "bvBar 6.5s linear both" }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Play sample journeys" : "Pause sample journeys"} style={{ width: 44, height: 44, borderRadius: 999, border: "1.5px solid rgba(20,45,59,0.18)", background: "#fff", color: "var(--navy)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {paused ? <PlayIcon /> : <PauseIcon />}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginTop: 26 }}>
            <div style={{ flex: "2 1 560px", minWidth: 0 }}>
              <div key={`r${swap}`} className="bv-swap" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "var(--ivory)", borderRadius: 18 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: "0.02em" }}>{d.fromCode}</div>
                  <div style={{ fontSize: 14, color: "var(--ink-mute)", marginTop: 4 }}>{d.from}</div>
                </div>
                <div aria-hidden="true" style={{ flex: 1, position: "relative", height: 26 }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "1.5px dashed #9DBFB4" }} />
                  <span style={{ position: "absolute", top: 1, marginLeft: -12, color: "var(--teal)", display: "inline-flex", animation: "bvFly 3.2s ease-in-out infinite" }}>
                    <Plane size={24} fill="#F7F4EC" style={{ transform: "rotate(45deg)" }} />
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: "0.02em" }}>{d.toCode}</div>
                  <div style={{ fontSize: 14, color: "var(--ink-mute)", marginTop: 4 }}>{d.city}</div>
                </div>
              </div>

              <ol style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: "18px 0" }}>
                {d.steps.map((s, i) => (
                  <li key={`${swap}-${i}`} className="bv-swap" style={{ minWidth: 0, paddingRight: 16, animationDelay: `${0.08 * i}s` }}>
                    <div style={{ position: "relative", height: 40, marginBottom: 12 }}>
                      {i < d.steps.length - 1 && <span aria-hidden="true" style={{ position: "absolute", left: 48, right: 8, top: 19, height: 2, background: "linear-gradient(90deg, #9CC9B9, #DDEBE5)" }} />}
                      <span aria-hidden="true" style={{ position: "relative", width: 40, height: 40, borderRadius: 12, background: "var(--sage)", color: "var(--teal-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {STEP_ICON[s[0]]}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{s[1]}</div>
                    <div style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.4, marginTop: 4 }}>{s[2]}</div>
                    <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: s[3] === "Proposed" ? "var(--sage)" : "#FCE7D6", color: s[3] === "Proposed" ? "var(--teal-ink)" : "var(--rust)" }}>{s[3]}</span>
                  </li>
                ))}
              </ol>

              <div key={`w${swap}`} className="bv-swap" style={{ marginTop: 22, padding: "14px 18px", background: "var(--sage)", borderRadius: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Sparkle size={18} style={{ color: "var(--teal-ink)", flex: "none", marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal-ink)" }}>Why this fits · AI suggestion (sample)</div>
                  <div style={{ fontSize: 16, lineHeight: 1.45, marginTop: 2 }}>{d.why}</div>
                </div>
              </div>
            </div>

            <div style={{ flex: "1 1 300px", minWidth: 0, borderLeft: "1px solid rgba(20,45,59,0.1)", paddingLeft: 32, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-mute)" }}>Estimated total</span>
              <span key={`t${swap}${cur.code}`} className="bv-swap" style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 2 }}>
                {money(total)}
              </span>
              <div key={`b${swap}`} className="bv-grow" aria-hidden="true" style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", marginTop: 16, gap: 2 }}>
                {parts.map((p) => (
                  <span key={p[0]} style={{ display: "block", height: "100%", minWidth: 4, width: `${(p[1] / total) * 100}%`, background: p[2] }} />
                ))}
              </div>
              <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px 18px", fontSize: 14 }}>
                {parts.map((p) => (
                  <li key={p[0]} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: p[2] }} />
                    <span style={{ color: "var(--ink-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p[0]}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 600 }}>{money(p[1])}</span>
                  </li>
                ))}
              </ul>
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>Illustrative estimate in {cur.code} at sample rates, not a quote. Nothing is booked until you approve it.</p>
              <div style={{ marginTop: "auto", paddingTop: 20 }}>
                <div style={{ padding: 14, borderRadius: 18, background: "var(--ivory)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="avatar" aria-hidden="true" style={{ position: "relative", width: 46, height: 46, background: "var(--sand)", fontWeight: 700 }}>
                    {d.coord[1]}
                    <span style={{ position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 999, background: "var(--teal)", border: "2px solid var(--ivory)" }} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{d.coord[0]}</div>
                    <div style={{ fontSize: 14, color: "var(--ink-mute)" }}>Your coordinator · {d.coord[2]}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mute)" }}>Sample</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main>
        {/* ===== MARQUEE ===== */}
        <section aria-label="What Bon Voyage connects" style={{ marginTop: 72, borderTop: "1px solid rgba(20,45,59,0.1)", borderBottom: "1px solid rgba(20,45,59,0.1)", overflow: "hidden", padding: "22px 0" }}>
          <div style={{ display: "flex", width: "max-content", animation: "bvMarquee 45s linear infinite" }}>
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", alignItems: "center", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                {MARQUEE.map((m) => (
                  <li key={m} style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ padding: "0 28px" }}>{m}</span>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--sand)" }} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section id="how" aria-labelledby="how-h" className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(72px, 9vw, 120px)", paddingBottom: 110 }}>
          <div className="bv-rv" style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <p className="h-kicker">How it works</p>
              <h2 id="how-h" className="h-sec-title">Tell us once. We connect the moving parts.</h2>
            </div>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 19, maxWidth: "24em" }}>Three steps from first question to a plan you can actually follow.</p>
          </div>
          <ol style={{ margin: "56px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
            <HowCard n="01" title="Tell us what you need." body="Describe it in your own words, or speak. The assistant picks out the details and only asks about what’s missing. Share documents only if you want to.">
              <div aria-hidden="true" style={{ marginTop: "auto", padding: 22, background: "var(--navy)", borderRadius: 20, color: "var(--ivory)" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Tell me what’s happening.</div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "var(--navy)", borderRadius: 999, padding: "6px 6px 6px 18px" }}>
                  <span style={{ flex: 1, fontSize: 16, minHeight: 24 }}>
                    <span style={{ display: "inline-block", overflow: "hidden", whiteSpace: "nowrap", verticalAlign: "bottom", animation: "bvTypeLoop 6s steps(15) infinite" }}>My father, 68…</span>
                    <span className="bv-caret" style={{ color: "var(--teal)", fontWeight: 700 }}>|</span>
                  </span>
                  <span style={{ width: 38, height: 38, borderRadius: 999, background: "var(--teal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Arrow size={18} />
                  </span>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#C3D1CD" }}>
                  <Sparkle size={14} style={{ color: "var(--mint)" }} /> 6 details found · 3 questions left
                </div>
              </div>
            </HowCard>
            <HowCard n="02" title="Explore personalized care and travel options." body="Compare providers side by side with estimated care and travel costs, proposed timing, and exactly what still needs confirming.">
              <div aria-hidden="true" style={{ marginTop: 28, padding: 16, background: "var(--ivory)", borderRadius: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Sample clinic A", 4620, [69, 17, 12, 2], "2 visits · 8 nights · estimate", "var(--ink-mute)", "100%"], ["Sample clinic B", 4180, [60, 19, 20, 1], "Lower estimate, longer stay · 3 visits · 12 nights", "var(--rust)", "90%"]].map(([name, amt, w, note, color, width]) => (
                  <div key={name as string} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", fontSize: 15 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{name as string}</strong>
                      <strong>{money(amt as number)}</strong>
                    </div>
                    <div style={{ display: "flex", height: 6, borderRadius: 6, overflow: "hidden", marginTop: 10, gap: 2, width: width as string }}>
                      {(w as number[]).map((x, k) => (
                        <span key={k} className="bv-rv-grow" style={{ display: "block", width: `${x}%`, background: ["#197C78", "#142D3B", "#9CC9B9", "#F3AE78"][k] }} />
                      ))}
                    </div>
                    <div style={{ color: color as string, fontSize: 13, marginTop: 6 }}>{note as string}</div>
                  </div>
                ))}
              </div>
            </HowCard>
            <HowCard n="03" title="Coordinate your journey with AI assistance and human support." body="Flights, stay, transfers and documents live in one plan. Ask for a change and see everything it affects before you decide.">
              <div aria-hidden="true" style={{ marginTop: 28, padding: 18, background: "var(--ivory)", borderRadius: 20 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "#fff", border: "1px solid rgba(20,45,59,0.14)", fontSize: 15, fontWeight: 600 }}>
                  <Sparkle size={14} style={{ color: "var(--teal)" }} />“Bring my partner”
                </div>
                <div style={{ marginTop: 12, fontSize: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[["Flights", "1 → 2 travellers"], ["Room", "Single → double"], ["Transfers", "2 seats"]].map(([a, b]) => (
                    <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: "var(--ink-mute)" }}>{a}</span>
                      <span style={{ fontWeight: 600 }}>{b}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="bv-ring" style={{ padding: "8px 14px", borderRadius: 999, background: "var(--teal)", color: "#fff", fontSize: 13, fontWeight: 600 }}>Apply to my draft</span>
                  <span style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(20,45,59,0.22)", fontSize: 13, fontWeight: 600 }}>Ask my coordinator</span>
                </div>
              </div>
            </HowCard>
          </ol>
        </section>

        {/* ===== BENEFITS ===== */}
        <section id="why" aria-labelledby="why-h" className="wrap" style={{ maxWidth: 1240, paddingBottom: 120 }}>
          <div className="bv-rv">
            <p className="h-kicker">Why Bon Voyage</p>
            <h2 id="why-h" className="h-sec-title">Fewer loose ends. More clarity.</h2>
          </div>
          <ul style={{ margin: "48px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 20 }}>
            <li className="bv-rv bv-lift h-card" style={{ flex: "2 1 560px", minWidth: 0, padding: 36, display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>Clearer cost comparisons</h3>
                <p style={{ margin: "12px 0 0", color: "var(--ink-soft)" }}>Care, flights, stay and transfers side by side in your currency, with estimates marked apart from confirmed quotes.</p>
              </div>
              <div aria-hidden="true" style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {[["Option A", 5845, [66.7, 13.3, 17.9, 2.1], "100%"], ["Option B", 5420, [55.4, 14.4, 27.7, 2.5], "92.7%"]].map(([n, a, w, width]) => (
                  <div key={n as string}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>{n as string}</span>
                      <span style={{ fontWeight: 700 }}>{money(a as number)}</span>
                    </div>
                    <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", gap: 3, width: width as string }}>
                      {(w as number[]).map((x, k) => (
                        <span key={k} className="bv-rv-grow" style={{ display: "block", width: `${x}%`, background: ["#197C78", "#142D3B", "repeating-linear-gradient(135deg, #9CC9B9 0 6px, #C5E0D6 6px 12px)", "#F3AE78"][k] }} />
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 13, color: "var(--ink-mute)" }}>
                  {[["Care", "#197C78"], ["Flights", "#142D3B"], ["Stay (estimate)", "repeating-linear-gradient(135deg, #9CC9B9 0 3px, #C5E0D6 3px 6px)"], ["Transfers", "#F3AE78"]].map(([l, c]) => (
                    <span key={l} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </li>
            <li className="bv-rv bv-lift" style={{ flex: "1 1 300px", minWidth: 0, background: "var(--sage)", borderRadius: 28, padding: 36 }}>
              <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700 }}>Fewer disconnected arrangements</h3>
              <p style={{ margin: "10px 0 0", color: "#2F4552", fontSize: 16 }}>When an appointment moves, everything that depends on it is flagged together.</p>
              <div aria-hidden="true" style={{ marginTop: 22, background: "#fff", borderRadius: 18, padding: 16, fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <span className="bv-ring" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--sand)" }} />
                  Procedure moved · Mar 5 → Mar 6
                </div>
                <div style={{ margin: "10px 0 0 3px", paddingLeft: 14, borderLeft: "2px dashed #9CC9B9", display: "flex", flexDirection: "column", gap: 8 }}>
                  {[["Clinic transfer", "Time updated", "var(--teal-ink)"], ["Hotel", "+1 night proposed", "var(--rust)"], ["Return flight", "No change", "var(--ink-mute)"]].map(([a, b, c]) => (
                    <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{a}</span>
                      <span style={{ color: c, fontWeight: 600 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </li>
            <li className="bv-rv bv-lift" style={{ flex: "1 1 300px", minWidth: 0, background: "var(--navy)", color: "var(--ivory)", borderRadius: 28, padding: 36, overflow: "hidden" }}>
              <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700 }}>Planning shaped around you</h3>
              <p style={{ margin: "10px 0 0", color: "#C3D1CD", fontSize: 16 }}>Your budget, dates, language, access needs and travel companions shape every proposal—and we explain why.</p>
              <div aria-hidden="true" style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[[`${money(6000)} budget`, "rgba(247,244,236,0.1)", "var(--ivory)"], ["Arabic-speaking staff", "#F3AE78", "#142D3B"], ["Step-free room", "rgba(247,244,236,0.1)", "var(--ivory)"], ["Partner travelling", "#6FD0C3", "#142D3B"], ["Home within 2 weeks", "rgba(247,244,236,0.1)", "var(--ivory)"]].map(([t, bg, fg], k) => (
                  <span key={t} className="bv-bob" style={{ padding: "8px 14px", borderRadius: 999, background: bg, color: fg, border: bg.startsWith("rgba") ? "1px solid rgba(247,244,236,0.18)" : "none", fontSize: 14, fontWeight: 600, animationDelay: `${k * 0.6}s` }}>
                    {t}
                  </span>
                ))}
              </div>
            </li>
            <li className="bv-rv bv-lift h-card" style={{ flex: "2 1 560px", minWidth: 0, padding: 36, display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>A coordinator who knows your story</h3>
                <p style={{ margin: "12px 0 0", color: "var(--ink-soft)" }}>When you need a person, the assistant drafts a short brief of your plan, recent changes and open questions—so you never start over. You review it before it’s shared.</p>
              </div>
              <div aria-hidden="true" style={{ flex: "1 1 280px", minWidth: 0, background: "var(--ivory)", borderRadius: 20, padding: 20, fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="avatar" style={{ width: 36, height: 36, background: "var(--sand)", fontWeight: 700 }}>HM</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Brief for Hala</div>
                    <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>Ready for your review</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[["Plan", "Colon cancer care · Cairo"], ["Preferences", "Arabic · close to family"], ["Changed", "First appointment → +2 days"], ["Open", "2 questions"]].map(([a, b]) => (
                    <div key={a} style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: "var(--ink-mute)", width: 92, flex: "none" }}>{a}</span>
                      <span style={{ fontWeight: 600 }}>{b}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "var(--teal)", color: "#fff", fontWeight: 600, fontSize: 13 }}>Review and share</div>
              </div>
            </li>
          </ul>
        </section>

        {/* ===== ROLES ===== */}
        <section aria-labelledby="roles-h" style={{ background: "var(--navy)", color: "var(--ivory)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", left: "-15%", bottom: "-60%", width: "60%", height: "140%", background: "radial-gradient(closest-side, rgba(25,124,120,0.35), rgba(25,124,120,0) 70%)" }} />
          <div className="wrap" style={{ position: "relative", maxWidth: 1240, paddingTop: "clamp(64px, 9vw, 120px)", paddingBottom: "clamp(64px, 9vw, 120px)" }}>
            <div className="bv-rv">
              <p className="h-kicker" style={{ color: "var(--sand)" }}>Clear responsibilities</p>
              <h2 id="roles-h" className="h-sec-title">You always know who handles the next step.</h2>
            </div>
            <div style={{ position: "relative", marginTop: 64 }}>
              <div aria-hidden="true" className="hide-sm" style={{ position: "absolute", left: 22, right: 22, top: 21, height: 2, background: "rgba(247,244,236,0.16)" }}>
                <span style={{ position: "absolute", top: -5, width: 12, height: 12, marginLeft: -6, borderRadius: 999, background: "var(--sand)", boxShadow: "0 0 18px 4px rgba(243,174,120,0.55)", animation: "bvTravel 7s ease-in-out infinite alternate" }} />
              </div>
              <ul style={{ position: "relative", margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32 }}>
                {[
                  [<Sparkle key="s" size={18} />, "AI assistance", "Prepares", "Reads your story, remembers your preferences, connects dependencies, and drafts options and changes for you to review."],
                  [<Check key="c" size={18} />, "You", "Decide", "Nothing is applied to your plan, or booked, until you approve it. Undo is always there."],
                  [<Person key="p" size={18} />, "Your coordinator", "Confirms", "Verifies availability, quotes and travel requirements against official sources, and steps in when plans change."],
                  [<Care key="m" size={18} />, "Clinicians", "Advise", "Treatment suitability, timing and recovery requirements come from licensed medical professionals."],
                ].map(([icon, who, verb, body]) => (
                  <li key={who as string} className="bv-rv">
                    <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 999, background: "var(--navy)", border: "2px solid var(--mint)", color: "var(--mint)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {icon}
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#B9D3CB", marginTop: 22 }}>{who}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{verb}</div>
                    <p style={{ margin: "8px 0 0", fontSize: 16, color: "#D8E2DE" }}>{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" aria-labelledby="faq-h" className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(72px, 9vw, 120px)", paddingBottom: "clamp(72px, 9vw, 120px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 56 }}>
            <div className="bv-rv" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <p className="h-kicker">FAQ</p>
              <h2 id="faq-h" className="h-sec-title">Questions, answered plainly.</h2>
              <p style={{ margin: "20px 0 0", color: "var(--ink-soft)" }}>Something else on your mind? Your coordinator can help once you’ve started.</p>
            </div>
            <div className="bv-rv" style={{ flex: "2 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {FAQ.map(([q, a], i) => {
                const open = faq === i;
                return (
                  <div key={q} style={{ borderRadius: 22, transition: "background-color .25s ease, box-shadow .25s ease", background: open ? "#fff" : "rgba(255,255,255,0.45)", boxShadow: open ? "0 20px 40px -28px rgba(20,45,59,0.35)" : "inset 0 0 0 1px rgba(20,45,59,0.08)" }}>
                    <h3 style={{ margin: 0, fontSize: "inherit" }}>
                      <button type="button" onClick={() => setFaq(open ? -1 : i)} aria-expanded={open} style={{ width: "100%", background: "none", border: 0, padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, textAlign: "left", fontSize: 20, fontWeight: 700, color: "var(--navy)", cursor: "pointer", minHeight: 44 }}>
                        <span>{q}</span>
                        <span aria-hidden="true" style={{ width: 40, height: 40, flex: "none", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform .3s ease, background-color .3s ease", background: open ? "var(--teal)" : "var(--sage)", color: open ? "#fff" : "var(--teal-ink)", transform: open ? "rotate(45deg)" : "none" }}>
                          <Plus />
                        </span>
                      </button>
                    </h3>
                    {open && (
                      <p className="bv-swap" style={{ margin: "-8px 0 0", padding: "0 clamp(24px, 6vw, 80px) 24px 24px", color: "var(--ink-soft)", fontSize: 17 }}>
                        {a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section aria-labelledby="cta-h" className="wrap" style={{ maxWidth: 1240, paddingBottom: 110 }}>
          <div className="bv-rv" style={{ position: "relative", overflow: "hidden", background: "var(--navy)", color: "var(--ivory)", borderRadius: 36, padding: "clamp(36px, 7vw, 96px)" }}>
            <svg viewBox="0 0 600 400" aria-hidden="true" style={{ position: "absolute", right: -40, top: -20, width: 620, height: 420 }}>
              <circle cx="430" cy="210" r="190" fill="none" stroke="#6FD0C3" strokeOpacity="0.16" />
              <ellipse cx="430" cy="210" rx="80" ry="190" fill="none" stroke="#6FD0C3" strokeOpacity="0.12" />
              <path d="M260 300 C 330 120, 470 90, 560 170" fill="none" stroke="#F3AE78" strokeWidth="2.5" strokeDasharray="2 12" strokeLinecap="round" style={{ animation: "bvMarch 1.1s linear infinite" }} />
              <path d="M300 120 C 380 60, 470 120, 520 260" fill="none" stroke="#6FD0C3" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="2 12" strokeLinecap="round" style={{ animation: "bvMarch 1.1s linear infinite" }} />
              <circle cx="560" cy="170" r="6" fill="#F3AE78" />
              <circle cx="560" cy="170" r="8" fill="none" stroke="#F3AE78" strokeWidth="2" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "bvPulseSvg 2.2s ease-out infinite" }} />
            </svg>
            <div style={{ position: "relative", maxWidth: 620 }}>
              <h2 id="cta-h" style={{ margin: 0, fontSize: "clamp(40px, 5vw, 68px)", lineHeight: 1, letterSpacing: "-0.035em", fontWeight: 800 }}>Ready when you are.</h2>
              <p style={{ margin: "20px 0 0", fontSize: 20, color: "#C3D1CD", maxWidth: "26em" }}>Tell the assistant what’s happening. It saves as you go, so you can continue any time, on any device.</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 36 }}>
                <Link href="/start" className="btn btn-primary bv-btn" style={btnPrimary}>
                  Start my journey
                  <Arrow size={20} className="bv-arrow" />
                </Link>
                <Link href={loginHref} className="btn btn-outline bv-ghost" style={{ ...btnPrimary, borderColor: "rgba(247,244,236,0.3)" }}>
                  {loginLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid rgba(20,45,59,0.1)" }}>
        <div className="wrap" style={{ maxWidth: 1240, paddingTop: 36, paddingBottom: 48, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Logo size={28} light={false} />
              <span style={{ fontSize: 18, fontWeight: 700 }}>Bon Voyage</span>
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--ink-mute)", maxWidth: "40em" }}>
              Bon Voyage coordinates care logistics and travel. It does not provide medical advice, diagnose conditions or determine visa eligibility. Prices, providers and people shown on this page are fictional samples.
            </p>
          </div>
          <nav aria-label="Footer" style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 15 }}>
            {["Privacy", "Terms", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{ color: "var(--navy)" }}>
                {l}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function HowCard({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="bv-rv bv-lift h-card" style={{ padding: 32, display: "flex", flexDirection: "column" }}>
      <span aria-hidden="true" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: "var(--teal)" }}>
        {n}
      </span>
      <h3 style={{ margin: "20px 0 0", fontSize: 24, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ margin: "10px 0 0", color: "var(--ink-soft)", fontSize: 16 }}>{body}</p>
      {children}
    </li>
  );
}
