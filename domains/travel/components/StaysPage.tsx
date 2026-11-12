"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flightContext, selectedStayFor, useCase } from "@/domains/case";
import { addDays, planningUsdRate } from "@/domains/pricing";
import type { StayQuote, StayResult } from "../staysProvider";
interface Quote extends StayQuote { localQuoteId: string; name: string; mode: "sample" | "test" }
interface StayBooking { id: string; status: string; total: string; currency: string; bookingReference: string | null; details: Record<string, unknown> }
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
export default function StaysPage() {
  const { state } = useCase();
  return <StayForm key={`${state.id}:${flightContext(state)}`} />;
}
function StayForm() {
  const { state, saveNow, patch } = useCase(); const selected = selectedStayFor(state);
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(state.flightSelection?.out ?? addDays(today, 21)); const [checkOut, setCheckOut] = useState(state.flightSelection?.back ?? addDays(today, 42));
  const [rooms, setRooms] = useState(1); const [guests, setGuests] = useState(state.travelSchedule?.passengers ?? 2); const [radiusKm, setRadius] = useState(5);
  const [searchId, setSearchId] = useState(""); const [results, setResults] = useState<StayResult[]>([]); const [quote, setQuote] = useState<Quote | null>(null); const [mode, setMode] = useState("sample");
  const [names, setNames] = useState<{ givenName: string; familyName: string }[]>([]); const [email, setEmail] = useState(state.intake.email); const [phone, setPhone] = useState(state.intake.phone);
  const [bookings, setBookings] = useState<StayBooking[]>([]); const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const attempt = useRef(""); const identity = useRef(state.id); const generation = useRef(0);
  useEffect(() => { identity.current = state.id; return () => { identity.current = ""; generation.current++; }; }, [state.id]);
  function changeSearch(update: () => void) {
    generation.current++; update(); setResults([]); setSearchId(""); setQuote(null); setNames([]); setAccepted(false); setMessage(""); setBusy(false); attempt.current = "";
    patch({ staySelection: null });
  }
  async function api(body: unknown) { const response = await fetch("/api/travel/stays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error === "price_changed" ? "The quote or property fees changed. Request a fresh quote and review again." : data.error === "stay_needs_coordinator" ? "Stays must be 1–99 nights and within 330 days. Ask your coordinator about longer stays." : "Stays are unavailable for these details. Try a new search or ask your coordinator."); return data; }
  async function refresh() { const caseId = state.id; const response = await fetch(`/api/travel/stays?caseId=${caseId}`, { cache: "no-store" }); if (response.ok) { const data = await response.json(); if (identity.current === caseId) setBookings(data.bookings); } }
  useEffect(() => { if (!state.sample) void refresh().catch(() => {}); }, [state.id, state.sample]);
  async function search(e: React.FormEvent) {
    e.preventDefault(); const request = ++generation.current; setBusy(true); setMessage(""); setQuote(null); setResults([]); setSearchId(""); setNames([]); setAccepted(false);
    try { await saveNow(); if (request !== generation.current) return; const data = await api({ action: "search", caseId: state.id, checkIn, checkOut, rooms, guests, radiusKm }); if (request !== generation.current) return; setResults(data.results); setSearchId(data.searchId); setMode(data.mode); if (!data.results.length) setMessage("No suitable stays found. Increase the radius or ask your coordinator to confirm accessibility."); }
    catch (e) { if (request === generation.current) setMessage(e instanceof Error ? e.message : "Stay search unavailable."); } finally { if (request === generation.current) setBusy(false); }
  }
  async function getQuote(resultId: string) {
    const request = ++generation.current; setBusy(true); setMessage(""); setQuote(null); setNames([]); setAccepted(false);
    try {
      const q: Quote = await api({ action: "quote", caseId: state.id, searchId, resultId }); if (request !== generation.current) return; setQuote(q); attempt.current = crypto.randomUUID();
      setNames(Array.from({ length: guests }, () => ({ givenName: "", familyName: "" })));
      const usdAmount = q.amount * planningUsdRate(q.currency) + (q.dueAtAccommodation === null ? 0 : q.dueAtAccommodation * planningUsdRate(q.dueCurrency));
      patch({ staySelection: { localQuoteId: q.localQuoteId, quoteId: q.quoteId, name: q.name, amount: q.amount, currency: q.currency, dueAtAccommodation: q.dueAtAccommodation, dueCurrency: q.dueCurrency, usdAmount, context: flightContext(state), checkIn: q.checkIn, checkOut: q.checkOut, sample: q.mode === "sample" } });
    } catch (e) { if (request === generation.current) setMessage(e instanceof Error ? e.message : "Quote unavailable."); } finally { if (request === generation.current) setBusy(false); }
  }
  async function book(e: React.FormEvent) {
    e.preventDefault(); if (!quote || !accepted) return; setBusy(true); setMessage("");
    try { const booking = await api({ action: "book", caseId: state.id, localQuoteId: quote.localQuoteId, attemptId: attempt.current, expectedAmount: quote.amount, currency: quote.currency, expectedDue: quote.dueAtAccommodation, dueCurrency: quote.dueCurrency, acceptedConditions: true, email, phone, guests: names }); setMessage(`Stay booking: ${booking.status.replaceAll("_", " ")}.`); setNames([]); setQuote(null); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Check your existing booking before retrying."); } finally { setBusy(false); }
  }
  return <main className="wrap flow-main"><section className="flow-section"><h1>A stay close to your hospital.</h1>
    <p className="pill pill-wait" style={{ width: "fit-content" }}>{mode === "sample" ? "Sample stays" : "Duffel test stays"} · live booking disabled</p>
    {state.sample ? <p>Sign in and save a case to search and quote stays. <Link href="/login">Sign in</Link>.</p> : <>
      <p>Mobility accessibility is {state.travelSchedule?.wheelchair ? "required by your case; unknown accessibility is excluded" : "not required by your current case"}. Update the assistance choice in <Link href="/case/flights">Flights</Link> if needed. All guests on this screen are adults; ask your coordinator for a stay with children.</p>
      <form onSubmit={search}><fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <label className="label">Check in<input className="field" type="date" min={today} required value={checkIn} onChange={(e) => changeSearch(() => setCheckIn(e.target.value))} /></label><label className="label">Check out<input className="field" type="date" min={checkIn} required value={checkOut} onChange={(e) => changeSearch(() => setCheckOut(e.target.value))} /></label>
        <label className="label">Rooms<input className="field" type="number" min={1} max={5} required value={rooms} onChange={(e) => changeSearch(() => setRooms(Number(e.target.value)))} /></label><label className="label">Adult guests<input className="field" type="number" min={1} max={9} required value={guests} onChange={(e) => changeSearch(() => setGuests(Number(e.target.value)))} /></label><label className="label">Hospital radius (km)<input className="field" type="number" min={1} max={100} required value={radiusKm} onChange={(e) => changeSearch(() => setRadius(Number(e.target.value)))} /></label>
      </fieldset><button className="btn btn-primary" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Checking…" : "Search stays"}</button></form>
      <p>Maximum 99 nights per booking. Longer stays go to a coordinator. Room prices below exclude property fees until a full quote is retrieved.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>{results.map((r) => <article className="card-d" key={r.resultId}><h2>{r.name}</h2><p>{r.distanceKm.toFixed(1)} km from hospital · {r.mobility === true ? "Mobility accessibility listed" : r.mobility === false ? "Mobility accessibility not listed" : "Accessibility unknown"}</p><p>Room total from {money(r.amount, r.currency)}</p><button type="button" className="btn btn-outline" disabled={busy} onClick={() => { void getQuote(r.resultId); }}>Retrieve rates and quote</button></article>)}</div>
      {quote && <form onSubmit={book} className="card-d" style={{ marginTop: 24 }}><h2>{quote.name} · current quote</h2><p>Room total: {money(quote.amount, quote.currency)}</p><p>Due at accommodation: {quote.dueAtAccommodation === null ? "Unknown; confirm additional fees with the property" : money(quote.dueAtAccommodation, quote.dueCurrency)}.</p><ul>{quote.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul><p>This quote is selected in your plan with fixed planning exchange rates. Accessibility requests need confirmation by the property; a coordinator task is created after booking.</p>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>{names.map((g, i) => <div key={i}><h3>Guest {i + 1}</h3><label className="label">Given name<input className="field" required maxLength={50} value={g.givenName} onChange={(e) => setNames((rows) => rows.map((row, n) => n === i ? { ...row, givenName: e.target.value } : row))} /></label><label className="label">Family name<input className="field" required maxLength={50} value={g.familyName} onChange={(e) => setNames((rows) => rows.map((row, n) => n === i ? { ...row, familyName: e.target.value } : row))} /></label></div>)}</div>
        <label className="label">Lead email<input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="label">Lead phone with country code<input className="field" required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label style={{ display: "flex", gap: 10, margin: "16px 0" }}><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I reviewed the room price, property fees, conditions and accessibility request that will be shared with the accommodation.</label><button className="btn btn-primary" disabled={!accepted || busy}>Confirm {mode === "sample" ? "sample" : "test"} stay booking</button></fieldset>
      </form>}
      {message && <p role="status">{message}</p>}
      {selected && <p>Selected in plan: {selected.name}. <Link href="/case/plan">Review your plan</Link>.</p>}
      <h2 style={{ marginTop: 24 }}>Stay bookings</h2>{bookings.map((b) => <article className="card-d" key={b.id}><h3>{String(b.details.name ?? "Stay")} · {b.status.replaceAll("_", " ")}</h3><p>{money(Number(b.total), b.currency)} · reference {b.bookingReference ?? "checking"}</p><ul>{Array.isArray(b.details.conditions) && b.details.conditions.map((c, i) => <li key={i}>{String(c)}</li>)}</ul><p>Due at accommodation: {b.details.dueAtAccommodation === null ? "Unknown" : `${b.details.dueAtAccommodation} ${b.details.dueCurrency}`}.</p><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setBusy(true); void api({ action: "reconcile", bookingId: b.id }).then(refresh).catch(() => setMessage("Still checking your stay; do not book a second time.")).finally(() => setBusy(false)); }}>Refresh stay booking</button></article>)}
    </>}
    <p><Link href="/case/plan">Continue to plan</Link></p>
  </section></main>;
}
