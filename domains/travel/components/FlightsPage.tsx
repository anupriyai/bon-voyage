"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flightContext, selectedFlightFor, useCase, useCaseModel, type TravelSchedule } from "@/domains/case";
import { findOptions, flightQuery, addDays, PriceWatchPanel, type FlightOptions, type RejectReason, type Pick } from "@/domains/pricing";
import { createMockProvider } from "@/domains/travel";
import { AssistantPrompt } from "@/shared/ui/Assistant";

const reasons: Record<RejectReason, string> = { "arrives-late": "Arrives too close to the appointment", "too-many-stops": "Too many stops", "long-layover": "Layover is too long", "tight-connection": "Connection leaves too little time", "other-currency": "Cannot compare a different currency" };
const money = (n: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (d: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
class FlightSearchError extends Error {}

export default function FlightsPage() {
  const { state, patch, saveNow } = useCase();
  const { chosen, plan } = useCaseModel();
  const defaults: TravelSchedule = { appointment: plan ? date(plan.first) : addDays(date(new Date()), 21), treatmentDays: 7, recoveryDays: 14, passengers: 2, wheelchair: false, flexDays: 1 };
  const schedule = state.travelSchedule ?? defaults;
  // Number inputs can temporarily hold invalid values before native form validation runs.
  const companionCount = Number.isFinite(schedule.passengers) ? Math.max(0, Math.min(8, Math.trunc(schedule.passengers) - 1)) : 0;
  const [options, setOptions] = useState<FlightOptions | null>(null);
  const [searchedContext, setSearchedContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [widened, setWidened] = useState(false);
  const run = useRef(0);
  useEffect(() => () => { run.current++; }, []);
  const currentContext = flightContext({ ...state, travelSchedule: schedule });
  const contextRef = useRef(currentContext);
  contextRef.current = currentContext;
  const selected = selectedFlightFor(state);
  const mode = options?.mode ?? selected?.mode;
  const label = mode === "test" ? "Duffel test fares · no live booking" : mode === "live" ? "Live fares · confirm before booking" : "Sample fares · nothing can be booked";
  const displayMoney = (n: number) => money(n, options?.currency ?? "USD");
  const change = (p: Partial<TravelSchedule>) => {
    patch({ travelSchedule: { ...schedule, ...p }, flightSelection: null });
    setOptions(null); setWidened(false); setError(""); run.current++;
  };

  async function search(widen: boolean) {
    const attempt = ++run.current;
    const context = currentContext;
    setBusy(true); setError("");
    try {
      try { flightQuery({ ...state, travelSchedule: schedule }, schedule); }
      catch (error) { throw new FlightSearchError(error instanceof Error ? error.message : "Check your travel details before searching."); }
      let result: FlightOptions;
      if (state.sample) result = await findOptions({ ...state, travelSchedule: schedule }, { ...schedule, widen }, createMockProvider());
      else {
        await saveNow();
        const ownResponse = await fetch(`/api/case?id=${state.id}`, { cache: "no-store" });
        if (!ownResponse.ok) throw new FlightSearchError("Please sign in and save this case before searching.");
        const owned = await ownResponse.json();
        const response = await fetch("/api/travel/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: state.id, revision: owned.revision, schedule: { ...schedule, widen } }) });
        if (!response.ok) {
          const data = await response.json();
          throw new FlightSearchError(response.status === 429 ? "The search allowance is in use. Wait for it to reset before retrying." : response.status === 409 ? "Your case changed. Reload your saved cases before searching again." : (data.error === "provider_not_configured" || data.error === "live_mode_disabled") ? "The configured flight provider is not enabled for this environment. Ask your coordinator to check setup." : "We couldn’t search these travel details. Check your dates, origin and hospital, then try again.");
        }
        result = await response.json();
      }
      if (attempt !== run.current || contextRef.current !== context) return;
      // Store the explicit planning assumptions with the selected flight, never infer clinical clearance.
      patch({ travelSchedule: schedule, flightSelection: null });
      setOptions(result); setSearchedContext(context); setWidened(widen);
    } catch (e) {
      if (attempt !== run.current || contextRef.current !== context) return;
      setError(e instanceof FlightSearchError ? e.message
        : e instanceof Error && e.message === "conflict" ? "Your case changed. Reload your saved cases before searching again."
          : e instanceof Error && e.message === "save_failed" ? "We couldn’t save your case before searching. Retry saving, then search again. Your working copy is on this device."
            : "We couldn’t connect to the flight search. Your planning details are still here. Check your connection and try again.");
    }
    finally { if (attempt === run.current) setBusy(false); }
  }
  function select(pick: Pick) {
    const t = pick.trip;
    patch({ travelSchedule: schedule, flightSelection: { id: t.id, amount: t.totalAmount + t.fees + t.groundCost, currency: options!.currency, fareAmount: t.totalAmount, fees: t.fees, extraGround: t.groundCost, usdAmount: (t.totalAmount + t.fees + t.groundCost) * options!.usdPerUnit, mode: options!.mode, ...(options!.searchId ? { searchId: options!.searchId } : {}), context: currentContext, from: t.slices[0].from, to: t.slices[0].to, out: t.slices[0].segments[0].departAt.slice(0, 10), back: t.slices[1].segments[0].departAt.slice(0, 10), sample: options!.sample, selectedAt: new Date().toISOString() } });
  }
  return (
    <main className="wrap flow-main">
      <section className="flow-section">
        <AssistantPrompt title="An easier journey to your care." help="Compare the total price and the time spent travelling. These are planning estimates; your care team confirms when you can fly." status={busy ? "Comparing flights" : "Ready when you are"}>
          <p className="pill pill-wait" style={{ width: "fit-content" }}>{label}</p>
          {!chosen ? <p>Choose a hospital in <Link href="/case/options">Options</Link> first.</p> : chosen.route.mode !== "flight" ? <p>Your selected hospital uses local transport. <Link href="/case/plan">Continue to your plan</Link>.</p> : <>
            <p>To {chosen.hospital.city} · patient and companions. Prices are for the whole party in the fare’s billing currency.</p>
            <form onSubmit={(e) => { e.preventDefault(); void search(false); }}>
              <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <label className="label">Planning appointment<input className="field" type="date" required min={addDays(date(new Date()), 2)} value={schedule.appointment} onChange={(e) => change({ appointment: e.target.value })} /></label>
                <label className="label">Treatment days<input className="field" type="number" required min={1} max={730} value={schedule.treatmentDays} onChange={(e) => change({ treatmentDays: Number(e.target.value) })} /></label>
                <label className="label">Recovery days<input className="field" type="number" required min={0} max={730} value={schedule.recoveryDays} onChange={(e) => change({ recoveryDays: Number(e.target.value) })} /></label>
                <label className="label">Travellers<input className="field" type="number" required min={1} max={9} value={schedule.passengers} onChange={(e) => change({ passengers: Number(e.target.value), companionAges: Array.from({ length: Math.max(0, Math.min(8, Number(e.target.value) - 1)) }, (_, n) => schedule.companionAges?.[n] ?? 30) })} /></label>
                {Array.from({ length: companionCount }, (_, n) => <label className="label" key={n}>Companion {n + 1} age<input className="field" type="number" min={0} max={120} required value={schedule.companionAges?.[n] ?? 30} onChange={(e) => change({ companionAges: Array.from({ length: companionCount }, (_, i) => i === n ? Number(e.target.value) : schedule.companionAges?.[i] ?? 30) })} /></label>)}
                <label className="label">Date flexibility<select className="field" value={schedule.flexDays} onChange={(e) => change({ flexDays: Number(e.target.value) as 0 | 1 })}><option value={0}>Target dates + transit</option><option value={1}>One day</option></select></label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={schedule.wheelchair} onChange={(e) => change({ wheelchair: e.target.checked })} />Wheelchair assistance needed</label>
              </fieldset>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>Arrival is at least two days before your appointment; return is after treatment and recovery. The initial 7 treatment and 14 recovery days are editable planning assumptions, subject to clinician approval. Widening tries at most two extra round-trip searches.</p>
              <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Searching…" : "Search flights"}</button><Link href="/case/plan" className="btn btn-outline">Continue to plan</Link></div>
            </form>
            {error && <p role="alert">{error}</p>}
            {options && searchedContext === currentContext && <div aria-live="polite">
              <p style={{ marginTop: 24 }}>{options.from} → {options.to} · {options.requests} round-trip {options.requests === 1 ? "search" : "searches"}{options.extraRequests > 0 ? ` (${options.extraRequests} extra)` : ""}. {options.failures > 0 && `${options.failures} extra searches were unavailable.`}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                {([["Cheapest", options.ranking.picks.cheapest], ["Easiest", options.ranking.picks.easiest], ["Best balance", options.ranking.picks.balanced]] as const).map(([title, pick]) => <article className="card-d" key={title}>
                  <h2 style={{ fontSize: 22, marginTop: 0 }}>{title}</h2>
                  {!pick ? <p>No suitable flight for these dates.</p> : <>
                    <div style={{ fontSize: 30, fontWeight: 500 }}>{displayMoney(pick.trip.totalAmount + pick.trip.fees + pick.trip.groundCost)}</div>
                    <p>{pick.why}</p><p>{pick.stops} stops across both directions · {pick.hours.toFixed(1)} hours total</p>
                    {pick.trip.slices.map((s, i) => <p key={i} style={{ fontSize: 14 }}>{i === 0 ? "Out" : "Back"}: {dayLabel(s.segments[0].departAt.slice(0, 10))} · {s.segments.map((g) => `${g.carrierName ?? g.carrier} ${g.flightNumber}: ${g.from} ${g.departAt.slice(11, 16)} → ${g.to} ${g.arriveAt.slice(11, 16)} (${dayLabel(g.arriveAt.slice(0, 10))})`).join("; ")} · local times</p>)}
                    <p style={{ fontSize: 14 }}>Fare {displayMoney(pick.trip.totalAmount)} + fees {displayMoney(pick.trip.fees)} + extra airport transfers {displayMoney(pick.trip.groundCost)} (estimate). Local transport remains in your plan.</p>
                    <p style={{ fontSize: 14 }}>{pick.trip.fares[0].conditions?.refund ?? "Refund terms unavailable; confirm before booking."}</p>
                    <p style={{ fontSize: 14 }}>{pick.trip.fares[0].conditions?.change ?? "Change terms unavailable; confirm before booking."}</p>
                    <button type="button" className="btn btn-outline" aria-pressed={selected?.id === pick.trip.id} onClick={() => select(pick)}>{selected?.id === pick.trip.id ? "Selected for plan" : "Choose this fare"}</button>
                  </>}
                </article>)}
              </div>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>USD ranking penalties and plan conversions use fixed planning exchange rates ({options.usdPerUnit} USD per {options.currency}); these are estimates, not a settlement quote.</p>
              <h2 style={{ fontSize: 24 }}>Departure price calendar</h2>
              <p style={{ color: "var(--muted)" }}>Lowest suitable total seen on each searched day. Unsearched days have no price.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {options.window.outbound.map((day) => { const cell = options.calendar.find((c) => c.day === day); return <div key={day} className="card-d" style={{ minWidth: 115 }}><div>{dayLabel(day)}</div><strong>{cell ? displayMoney(cell.amount) : "No fare seen"}</strong></div>; })}
              </div>
              <div className="actions"><button type="button" className="btn btn-outline" disabled={busy || widened} onClick={() => { void search(true); }}>{widened ? "Search widened" : "Widen search · up to 2 extra"}</button></div>
              {options.ranking.rejected.length > 0 && <details style={{ marginTop: 20 }}><summary>Why {options.ranking.rejected.length} trips were excluded</summary><ul>{options.ranking.rejected.map((r) => <li key={r.trip.id}>{r.trip.slices[0].from} → {r.trip.slices[0].to} · {dayLabel(r.trip.slices[0].segments[0].departAt.slice(0, 10))}: {r.reasons.map((reason) => reasons[reason]).join("; ")}</li>)}</ul></details>}
            </div>}
            {!state.sample && <PriceWatchPanel key={`${state.id}:${selected?.searchId ?? ""}:${selected?.id ?? ""}`} beforeCreate={saveNow} caseId={state.id} searchId={selected?.searchId} offerId={selected?.id} />}
            {selected && <p role="status" style={{ marginTop: 24 }}>Selected {selected.sample ? "sample " : selected.mode === "test" ? "test-mode " : ""}flights: {money(selected.amount, selected.currency)} for your party. <Link href="/case/plan">Review your updated plan</Link>. {selected.searchId && <Link href="/case/booking">Review test booking</Link>}</p>}
          </>}
        </AssistantPrompt>
      </section>
    </main>
  );
}
