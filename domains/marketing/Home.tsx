"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCurrency } from "@/shared/lib/currency";
import { JourneyCTA, SiteFooter, SiteHeader } from "./SiteChrome";
import CurrencyMenu from "@/shared/ui/CurrencyMenu";
import Globe, { type GlobeRoute } from "@/shared/ui/Globe";
import { Arrow, Bed, Car, Care, Check, PauseIcon, Plane, PlayIcon, Plus } from "@/shared/ui/Icons";
import { COUNTRIES } from "@/domains/providers";

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

// Cancer care travel sketches. Destinations and travel amounts are illustrative; no clinic or appointment is implied.
const DESTS: Dest[] = [
  { city: "Amman", country: "Jordan", continent: "Asia", from: "Riyadh", fromCode: "RUH", toCode: "AMM", geo: [[46.68, 24.71], [35.93, 31.95]], treatment: "Cancer second opinion", dates: "Travel dates to decide", nights: 7, travellers: "1 traveller", care: 0, flights: 480, stay: 630, transfers: 100,
    coord: ["Unassigned", "", "Support not staffed"],
    why: "A second opinion starts with a review of existing records. A qualified cancer team must confirm whether a consultation is available before travel is planned.",
    steps: [["flight", "Flight preference", "RUH → AMM · dates to decide", "Sample"], ["transfer", "Ground transfer", "Airport and accommodation", "Sample"], ["stay", "Stay preference", "7 nights · location to confirm", "Sample"], ["care", "Specialist review", "Provider and appointment not confirmed", "Not booked"], ["return", "Return preference", "Date after clinician review", "Not booked"]] },
  { city: "Istanbul", country: "Türkiye", continent: "Europe", from: "Beirut", fromCode: "BEY", toCode: "IST", geo: [[35.5, 33.89], [28.97, 41.01]], treatment: "Radiation oncology consultation", dates: "Travel dates to decide", nights: 7, travellers: "1 traveller", care: 0, flights: 520, stay: 770, transfers: 110,
    coord: ["Unassigned", "", "Support not staffed"],
    why: "Consultation and treatment are different steps. A cancer specialist must review records and confirm whether radiation therapy is relevant.",
    steps: [["flight", "Flight preference", "BEY → IST · dates to decide", "Sample"], ["transfer", "Ground transfer", "Airport and accommodation", "Sample"], ["stay", "Stay preference", "7 nights · location to confirm", "Sample"], ["care", "Cancer care consultation", "Provider and appointment not confirmed", "Not booked"], ["return", "Return preference", "Date after clinician review", "Not booked"]] },
  { city: "Berlin", country: "Germany", continent: "Europe", from: "London", fromCode: "LHR", toCode: "BER", geo: [[-0.12, 51.5], [13.4, 52.52]], treatment: "Medical oncology consultation", dates: "Travel dates to decide", nights: 7, travellers: "1 traveller", care: 0, flights: 400, stay: 910, transfers: 95,
    coord: ["Unassigned", "", "Support not staffed"],
    why: "A consultation can help discuss care options. Treatment, timing and fitness to fly require individual clinical review.",
    steps: [["flight", "Flight preference", "LHR → BER · dates to decide", "Sample"], ["transfer", "Ground transfer", "Airport and accommodation", "Sample"], ["stay", "Stay preference", "7 nights · location to confirm", "Sample"], ["care", "Cancer care consultation", "Provider and appointment not confirmed", "Not booked"], ["return", "Return preference", "Date after clinician review", "Not booked"]] },
];

const ROUTES: GlobeRoute[] = DESTS.map((d) => ({ a: d.geo[0], b: d.geo[1], aLabel: d.from, bLabel: d.city }));

const FAQ: [string, string][] = [
  ["What does Bon Voyage coordinate?", "The prototype brings cancer care questions, sample travel choices, accommodation and next steps into one plan. No real clinic appointment, flight or stay is arranged yet."],
  ["How does the AI assistant help?", "You describe the situation in your own words and the assistant picks out the details, asks only what’s missing, compares options and drafts changes. Every suggestion is labelled as a draft, and nothing happens until you approve it."],
  ["How reliable are the cost estimates?", "Early figures are estimates based on your preferences and sample pricing. Each item stays marked as an estimate until a provider or your coordinator confirms a quote, and any currency conversion is labeled as illustrative."],
  ["Can I talk to a real person?", "The experience is designed around a named coordinator, with a brief you review before sharing. In this prototype, coordinator profiles and messages demonstrate that experience; they are not connected to a staffed support inbox. Visit Help & Contact for the available next steps."],
  ["Do you give medical advice?", "No. Bon Voyage helps you organize and compare options. Decisions about treatment, timing and recovery are made by licensed clinicians."],
];

const STEP_ICON: Record<StepKind, React.ReactNode> = {
  flight: <Plane size={19} />,
  return: <Plane size={19} style={{ transform: "scaleX(-1)" }} />,
  transfer: <Car size={19} />,
  stay: <Bed size={19} />,
  care: <Care size={19} />,
};

export default function Home() {
  const { money, cur } = useCurrency();
  const [dest, setDest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!paused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer.current = window.setTimeout(() => setDest((d) => (d + 1) % DESTS.length), 8000);
    }
    return () => window.clearTimeout(timer.current);
  }, [dest, paused]);
  const pick = (i: number) => { setDest(i); setPaused(true); };
  const d = DESTS[dest];
  const total = d.care + d.flights + d.stay + d.transfers;
  return <div className="home" id="top">
    <SiteHeader />
    <main>
      <section className="home-hero home-shell" aria-labelledby="hero-title">
        <div className="home-hero-copy">
          <h1 id="hero-title">Your care<br />journey,<br /><span>connected.</span></h1>
          <p>Cancer care questions, travel and the next steps.<br className="home-desktop-break" /> Brought together in one plan, shaped around you.</p>
          <div className="home-hero-actions"><Link href="/start" className="btn btn-primary">Start my journey <Arrow size={21} /></Link><a className="home-text-link" href="#sample-journey">Explore a sample journey</a></div>
        </div>
        <div className="home-globe"><Globe routes={ROUTES} active={dest} onPick={pick} showAll={false} plane animate={!paused} /></div>
      </section>
      <section className="explore-home-search home-shell" aria-labelledby="public-care-title"><div className="explore-home-search-heading"><div><p className="h-kicker">Explore first. Plan at your pace.</p><h2 id="public-care-title">Cancer care, with clearer next steps.</h2></div><Link href="/explore" className="home-text-link">Explore cancer care <Arrow size={17} /></Link></div><form action="/explore" className="explore-search-bar"><label className="explore-search-treatment"><span>What cancer care?</span><input type="search" name="q" placeholder="Second opinion, radiation, surgery…" /></label><label className="explore-search-country"><span>Where?</span><select name="country"><option value="">Anywhere</option>{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label><button type="submit" className="btn btn-primary">Search care <Arrow size={18} /></button></form><p className="explore-small">Browse without an account. Clinic listings and prices appear only after verification.</p><div className="explore-home-quick"><Link href="/treatments/oncology-second-opinion">Second opinion</Link><Link href="/treatments/radiation-oncology">Radiation oncology</Link><Link href="/treatments/surgical-oncology">Cancer surgery</Link><Link href="/destinations">All {COUNTRIES.length} countries & territories <Arrow size={14} /></Link></div></section>
      <ul className="home-reassurance home-shell">{["Tell it in your own words", "Estimates clearly labelled", "No fictional clinic listings"].map((text) => <li key={text}><Check size={20} />{text}</li>)}</ul>
      <section className="home-sample home-shell" id="sample-journey" aria-labelledby="sample-title">
        <div className="home-sample-summary">
          <div><p className="h-kicker">Illustrative sample journey</p><h2 id="sample-title">{d.treatment} in {d.city}</h2><p className="home-sample-origin">{d.from} → {d.city}, {d.country}</p></div>
          <div className="home-sample-route"><p>Care · Flights · Stay · Transfers</p><div className="home-route-icons" aria-hidden="true"><Care /><Plane /><Bed /><Car /></div></div>
          <div className="home-sample-total"><span>Sample travel subtotal</span><strong>{money(total)}</strong><small>Cancer care cost unknown and excluded.</small></div>
        </div>
        <div className="home-sample-controls"><div className="home-destinations" aria-label="Sample destinations">{DESTS.map((item, i) => <button type="button" key={item.city} aria-pressed={dest === i} onClick={() => pick(i)}>{item.city}</button>)}<button type="button" className="home-cycle" onClick={() => setPaused(!paused)} aria-label={paused ? "Play globe animation" : "Pause globe animation"}>{paused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}<span>{paused ? "Play animation" : "Pause animation"}</span></button></div><CurrencyMenu note="Illustrative planning rates. Your coordinator confirms real quotes." /></div>
        <details className="home-sample-details"><summary>See this sample plan <Plus size={17} /></summary><div className="home-sample-expanded"><div><p className="home-sample-caption">{d.dates} · {d.nights} nights · {d.travellers} · no provider selected</p><ol className="home-itinerary">{d.steps.map(([kind, title, detail, status]) => <li key={title}><span className="home-itinerary-icon">{STEP_ICON[kind]}</span><div><strong>{title}</strong><p>{detail}</p></div><small>{status}</small></li>)}</ol></div><div className="home-costs"><h3>What’s in the estimate</h3><dl><div><dt>Cancer care</dt><dd>Unknown · excluded</dd></div>{[["Sample flights", d.flights], [`Sample stay · ${d.nights} nights`, d.stay], ["Sample transfers", d.transfers]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{money(Number(amount))}</dd></div>)}</dl><p className="home-sample-caption">Illustrative travel amounts in {cur.code} at sample exchange rates. Nothing is booked.</p><h3>What to confirm</h3><p>{d.why}</p><p className="home-sample-caption">No coordinator or clinic is assigned.</p></div></div></details>
      </section>
      <section id="how" className="home-section home-shell" aria-labelledby="how-title"><p className="h-kicker">How it works</p><div className="home-section-heading"><h2 id="how-title">Tell us once.<br />We connect the moving parts.</h2><p>From the first question to a sample plan you can review.</p></div><ol className="home-steps">{[["01", "Start with your story", "Describe what’s happening in your own words. The assistant asks only what’s missing."], ["02", "See your options clearly", "Explore cancer care questions and sample travel, with unknown costs left visible."], ["03", "Bring the journey together", "Review a sample plan. A real clinic and coordinator must be confirmed before arrangements can begin."]].map(([n, title, body]) => <li key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></li>)}</ol></section>
      <section id="why" className="home-why" aria-labelledby="why-title"><div className="home-shell home-section"><p className="h-kicker">Why Bon Voyage</p><div className="home-section-heading"><h2 id="why-title">Fewer loose ends.<br />More clarity.</h2><p>Cancer care abroad has a lot of moving parts. Your sample plan keeps them in view.</p></div><div className="home-principles">{[["Transparent estimates", "Known sample travel amounts and unknown cancer care costs are shown separately."], ["A plan shaped around you", "Your budget, language, mobility needs and travel companions shape each draft."], ["Clear support status", "Coordinator messages in this prototype are examples; no staffed team receives them yet."], ["You stay in control", "AI prepares suggestions. You decide. Licensed clinicians confirm treatment suitability and recovery timing."]].map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
      <section id="faq" className="home-section home-shell home-faq" aria-labelledby="faq-title"><div><p className="h-kicker">A little more clarity</p><h2 id="faq-title">Questions,<br />answered plainly.</h2></div><div>{FAQ.map(([q, a], i) => <div className="home-faq-row" key={q}><h3><button type="button" aria-expanded={faq === i} aria-controls={`faq-answer-${i}`} onClick={() => setFaq(faq === i ? null : i)}>{q}<Plus style={{ transform: faq === i ? "rotate(45deg)" : undefined }} /></button></h3>{faq === i && <p id={`faq-answer-${i}`}>{a}</p>}</div>)}</div></section>
      <JourneyCTA />
    </main>
    <SiteFooter />
  </div>;
}
