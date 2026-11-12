"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { selectedFlightFor, updatedFlightPrice, useCase } from "@/domains/case";
import { planningUsdRate } from "@/domains/pricing";
import type { Fare } from "@/domains/travel";
import { BookingPanel } from "./BookingPanel";
interface Traveler { givenName: string; familyName: string; bornOn: string; title: "mr" | "mrs" | "ms" | "miss" | "dr"; gender: "m" | "f"; email: string; phone: string; infantFor?: number }
export default function BookingPage() {
  const { state, saveNow, patch } = useCase(); const selected = selectedFlightFor(state);
  const [fare, setFare] = useState<Fare | null>(null); const [mode, setMode] = useState("sample");
  const [travelers, setTravelers] = useState<Traveler[]>([]); const [type, setType] = useState<"instant" | "hold">("instant");
  const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [refresh, setRefresh] = useState(0);
  const identity = useRef(state.id); identity.current = state.id;
  useEffect(() => { identity.current = state.id; return () => { identity.current = ""; }; }, [state.id]);
  const attempt = useRef(""); const [submitted, setSubmitted] = useState(false);
  async function quote() {
    if (!selected?.searchId) return;
    setBusy(true); setMessage("");
    try {
      await saveNow();
      const response = await fetch("/api/travel/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "quote", caseId: state.id, searchId: selected.searchId, offerId: selected.id }) });
      if (!response.ok) throw new Error("A fresh quote is unavailable. Search again or ask your coordinator to enable test booking.");
      const result = await response.json(); setFare(result.fare); setMode(result.mode); setAccepted(false); attempt.current = crypto.randomUUID();
      setTravelers(Array.from({ length: state.travelSchedule?.passengers ?? 1 }, () => ({ givenName: "", familyName: "", bornOn: "", title: "mr", gender: "m", email: state.intake.email, phone: state.intake.phone })));
    } catch (e) { setMessage(e instanceof Error ? e.message : "Quote unavailable."); } finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!fare || !selected?.searchId || !accepted || submitted) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/travel/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: state.id, searchId: selected.searchId, offerId: fare.id, attemptId: attempt.current, type, expectedAmount: fare.totalAmount, currency: fare.currency, acceptedConditions: true, travelers, assistance: state.travelSchedule?.wheelchair ?? false }) });
      const result = await response.json();
      if (!response.ok) { if (result.error === "price_changed") setFare(null); throw new Error(result.error === "price_changed" ? "The fare changed. Get a fresh quote and confirm again." : "The booking could not be submitted. Check the traveller details and refresh booking status before retrying."); }
      if (identity.current !== state.id) return;
      if (result.currency === selected.currency && ["held", "confirmed", "checking", "creating"].includes(result.status)) patch({ flightSelection: updatedFlightPrice(selected, Number(result.total), planningUsdRate(result.currency)) });
      setSubmitted(true); setTravelers([]); setMessage(`Booking status: ${result.status.replaceAll("_", " ")}.`); setRefresh((n) => n + 1);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Check booking status before trying again."); } finally { setBusy(false); }
  }
  return <main className="wrap flow-main"><section className="flow-section"><h1>Review your flight booking.</h1>
    <p>Booking is available for saved cases using sample or Duffel test fares. Live booking remains disabled.</p>
    {state.sample || !selected?.searchId ? <p>Sign in, save your case and select a fare from a saved search first. <Link href="/case/flights">Return to flights</Link>.</p> : <>
      {!submitted && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { void quote(); }}>Get fresh booking price</button>}
      {fare && !submitted && <form onSubmit={submit} style={{ marginTop: 24 }}>
        <p className="eyebrow">{mode === "sample" ? "Sample order" : "Duffel test order"}</p>
        <h2>{new Intl.NumberFormat("en-US", { style: "currency", currency: fare.currency }).format(fare.totalAmount)} · airfare for all travellers</h2>
        <p>{fare.conditions?.refund}</p><p>{fare.conditions?.change}</p>
        <p>Transfers remain estimates in the plan. Do not enter real passport details into this prototype. Identity documents required by an airline need the coordinator-assisted flow.</p>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
          {travelers.map((p, i) => <div className="card-d" key={i} style={{ marginTop: 12 }}><h3>Traveller {i + 1}</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {([['givenName', 'Given name'], ['familyName', 'Family name'], ['bornOn', 'Date of birth'], ['email', 'Email'], ['phone', 'Phone with country code']] as const).map(([key, label]) => <label className="label" key={key}>{label}<input className="field" required maxLength={key === "givenName" || key === "familyName" ? 20 : 250} type={key === "bornOn" ? "date" : key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={p[key]} onChange={(e) => setTravelers((rows) => rows.map((row, n) => n === i ? { ...row, [key]: e.target.value } : row))} /></label>)}
            <label className="label">Carrying adult (infants only)<input className="field" type="number" min={1} max={travelers.length} value={p.infantFor === undefined ? "" : p.infantFor + 1} placeholder="Adult traveller number" onChange={(e) => setTravelers((rows) => rows.map((row, n) => n === i ? { ...row, infantFor: e.target.value ? Number(e.target.value) - 1 : undefined } : row))} /></label>
            <label className="label">Title<select className="field" value={p.title} onChange={(e) => setTravelers((rows) => rows.map((row, n) => n === i ? { ...row, title: e.target.value as Traveler["title"] } : row))}>{["mr", "mrs", "ms", "miss", "dr"].map((title) => <option key={title}>{title}</option>)}</select></label>
            <label className="label">Airline gender marker<select className="field" value={p.gender} onChange={(e) => setTravelers((rows) => rows.map((row, n) => n === i ? { ...row, gender: e.target.value as "m" | "f" } : row))}><option value="m">Male</option><option value="f">Female</option></select></label>
          </div></div>)}
          <label className="label" style={{ marginTop: 14 }}>Booking type<select className="field" value={type} onChange={(e) => setType(e.target.value as "instant" | "hold")}><option value="instant">Instant test payment</option>{fare.holdable && <option value="hold">Hold and pay later</option>}</select></label>
          <label style={{ display: "flex", gap: 10, marginTop: 18 }}><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I reviewed the current fare, traveller details and refund/change conditions.</label>
          <button type="submit" className="btn btn-primary" disabled={!accepted || busy} style={{ marginTop: 18 }}>{busy ? "Checking booking…" : `Confirm ${mode === "sample" ? "sample" : "test"} ${type === "hold" ? "hold" : "booking"}`}</button>
        </fieldset>
      </form>}
      {message && <p role="status">{message}</p>}
      <BookingPanel caseId={state.id} refresh={refresh} />
    </>}
    <p><Link href="/case/plan">Back to plan</Link></p>
  </section></main>;
}
