"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod/v4";
import { authClient } from "@/domains/account/client";
import { careEstimate } from "@/domains/pricing";
import { SAMPLE_AIRPORTS, type Fare, type PublicStayOption } from "@/domains/travel";
import { useCurrency } from "@/shared/lib/currency";
import CurrencyMenu from "@/shared/ui/CurrencyMenu";
import { findPublicOffer, findTreatment } from "../catalogue";
import { CarePlanSchema, type CarePlanDraft, type SavedCarePlan } from "../plan";
import { carePlanApi as api } from "../plannerClient";

const BASE_KEY = "bv.publicCareDraft.v1";
const cityNames: Record<string, string> = { JFK: "New York", LAX: "Los Angeles", SFO: "San Francisco", IAH: "Houston", YVR: "Vancouver", SYD: "Sydney", SIN: "Singapore", LIM: "Lima", GDL: "Guadalajara", LIS: "Lisbon", BKK: "Bangkok", CPT: "Cape Town", OOL: "Gold Coast", ICN: "Seoul", BOG: "Bogotá", DEL: "New Delhi", KUL: "Kuala Lumpur", AKL: "Auckland", LHR: "London", IST: "Istanbul", BER: "Berlin", AMM: "Amman", CAI: "Cairo", DXB: "Dubai", AUH: "Abu Dhabi", RUH: "Riyadh", BEY: "Beirut", FRA: "Frankfurt", DOH: "Doha" };
const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const amount = z.number().finite().min(0).max(1000000000);
const segment = z.object({ from: z.string().length(3), to: z.string().length(3), departAt: z.string().max(50), arriveAt: z.string().max(50), carrier: z.string().max(20), flightNumber: z.string().max(30) });
const localFare = z.object({ id: z.string().max(500), provider: z.literal("mock"), currency: z.literal("USD"), totalAmount: amount, slices: z.array(z.object({ from: z.string().length(3), to: z.string().length(3), segments: z.array(segment).min(1).max(2) })).length(2), expiresAt: z.string().nullable(), holdable: z.boolean(), conditions: z.object({ refund: z.string().max(1000), change: z.string().max(1000) }).optional() });
const localStay = z.object({ resultId: z.string().max(2000), accommodationId: z.string().max(200), name: z.string().max(200), distanceKm: amount, mobility: z.boolean().nullable(), amount, currency: z.literal("USD"), quote: z.object({ rateId: z.string().max(2000), quoteId: z.string().max(2000), accommodationId: z.string().max(200), mobility: z.boolean().nullable(), amount, currency: z.literal("USD"), dueAtAccommodation: amount.nullable(), dueCurrency: z.literal("USD"), conditions: z.array(z.string().max(2000)).max(20), expiresAt: z.string().max(50), checkIn: z.string().length(10), checkOut: z.string().length(10) }) });
type LocalDraft = { draft: CarePlanDraft; fare: Fare | null; stay: PublicStayOption | null; updatedAt: number };
type InitialQuery = { from?: string; out?: string; back?: string; travellers?: string };
function emptyDraft(offerId: string, query: InitialQuery): CarePlanDraft {
  const parsed = CarePlanSchema.safeParse({ offerId, from: query.from ?? "", out: query.out ?? "", back: query.back ?? "", travellers: Number(query.travellers ?? 1), flightId: null, stayQuoteId: null });
  return parsed.success ? parsed.data : { offerId, from: "", out: "", back: "", travellers: 1, flightId: null, stayQuoteId: null };
}
function readLocal(key: string, offerId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key); if (!raw || raw.length > 60000) return null;
    const value = JSON.parse(raw); const parsed = CarePlanSchema.safeParse(value.draft);
    if (!parsed.success || parsed.data.offerId !== offerId || !Number.isFinite(value.updatedAt) || value.updatedAt > Date.now() || Date.now() - value.updatedAt > 86400000) return null;
    const flight = localFare.safeParse(value.fare); const accommodation = localStay.safeParse(value.stay);
    const fare = flight.success && flight.data.id === parsed.data.flightId ? flight.data : null;
    const stay = accommodation.success && accommodation.data.quote.quoteId === parsed.data.stayQuoteId && Date.parse(accommodation.data.quote.expiresAt) > Date.now() ? accommodation.data : null;
    return { draft: { ...parsed.data, flightId: fare?.id ?? null, stayQuoteId: stay?.quote.quoteId ?? null }, fare, stay, updatedAt: value.updatedAt };
  } catch { return null; }
}

export default function TripPlanner({ offerId, planId, resumeAnonymous = false, initialQuery = {} }: { offerId: string; planId?: string; resumeAnonymous?: boolean; initialQuery?: InitialQuery }) {
  const { money, cur } = useCurrency();
  const { data: authentication, isPending } = authClient.useSession(); const userId = authentication?.user.id;
  const [draft, setDraft] = useState(() => emptyDraft(offerId, initialQuery));
  const [fare, setFare] = useState<Fare | null>(null); const [stay, setStay] = useState<PublicStayOption | null>(null);
  const [flights, setFlights] = useState<Fare[]>([]); const [stays, setStays] = useState<PublicStayOption[]>([]);
  const [searchedFlights, setSearchedFlights] = useState(false); const [searchedStays, setSearchedStays] = useState(false);
  const [saved, setSaved] = useState<SavedCarePlan | null>(null); const [ready, setReady] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"flights" | "stays" | "save" | "request" | null>(null);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [accepted, setAccepted] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const generation = useRef(0); const requestAttempt = useRef(crypto.randomUUID()); const storageKey = userId ? `${BASE_KEY}:user:${userId}` : BASE_KEY;
  // The server already validated this route's offer. A stored draft must never
  // change which provider the public planner renders.
  const offer = findPublicOffer(offerId)!; const treatment = findTreatment(offer.treatmentId);
  const signature = JSON.stringify(draft); const savedCurrent = saved && JSON.stringify(saved.draft) === signature;
  const estimate = careEstimate({ careUsd: offer.priceUsd, transferUsd: offer.transferUsd, flightSelected: !!draft.flightId, flightUsd: fare?.totalAmount ?? null, staySelected: !!draft.stayQuoteId, stayUsd: stay?.quote.amount ?? null, propertyFeesUsd: stay?.quote.dueAtAccommodation ?? null });
  const datesReady = !!draft.out && !!draft.back && draft.back > draft.out;
  const quoteExpired = !!stay && Date.parse(stay.quote.expiresAt) <= clock;
  const loginHref = `/login?next=${encodeURIComponent(`/explore/trip?offer=${encodeURIComponent(offer.id)}&resume=1${planId ? `&plan=${encodeURIComponent(planId)}` : ""}`)}`;

  useEffect(() => {
    if (isPending) return;
    let cancelled = false; const version = ++generation.current; setReady(false); setLoadedStorageKey(null); setDraft(emptyDraft(offerId, initialQuery)); setError(""); setMessage(""); setSaved(null); setFlights([]); setStays([]); setFare(null); setStay(null); setSearchedFlights(false); setSearchedStays(false); setAccepted(false); setBusy(null);
    const load = async () => {
      let loaded = false;
      try {
        if (planId) {
          if (!userId) { setMessage("Sign in to open your saved care plan."); return; }
          const result = await api<{ plan: SavedCarePlan }>(`/api/explore/plans?id=${encodeURIComponent(planId)}`);
          if (cancelled || version !== generation.current) return;
          if (result.plan.draft.offerId !== offerId) {
            setError("This saved plan belongs to an older or different care listing. Open it from your account to review its archived details.");
            return;
          }
          setSaved(result.plan); setDraft(result.plan.draft);
          const local = readLocal(storageKey, offerId);
          if (local && JSON.stringify(local.draft) === JSON.stringify(result.plan.draft)) { setFare(local.fare); setStay(local.stay); }
          else if (result.plan.draft.flightId || result.plan.draft.stayQuoteId) setMessage("Saved travel choices loaded. Refresh sample searches to review current prices before sending a request.");
          loaded = true;
        } else {
          const hasExplicitTravel = Object.values(initialQuery).some(Boolean);
          const anonymous = userId && resumeAnonymous ? readLocal(BASE_KEY, offerId) : null;
          const local = anonymous ?? (hasExplicitTravel ? null : readLocal(storageKey, offerId));
          if (local) {
            setDraft(local.draft); setFare(local.fare); setStay(local.stay);
            if (anonymous && local === anonymous) { localStorage.setItem(storageKey, JSON.stringify(local)); localStorage.removeItem(BASE_KEY); setMessage("Your choices are restored. Review them, then choose Save plan. Nothing was submitted during sign-in."); }
          } else setDraft(emptyDraft(offerId, initialQuery));
          loaded = true;
        }
      } catch (e) { if (!cancelled && version === generation.current) setError(e instanceof Error ? e.message : "Your plan is unavailable."); }
      finally { if (!cancelled && version === generation.current) { setLoadedStorageKey(loaded ? storageKey : null); setReady(true); } }
    };
    void load(); return () => { cancelled = true; generation.current++; };
  // The URL selects a draft; subsequent edits are intentionally local until explicit save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, userId, planId, offerId, resumeAnonymous, initialQuery.from, initialQuery.out, initialQuery.back, initialQuery.travellers]);

  useEffect(() => {
    if (!ready || loadedStorageKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ draft, fare, stay, updatedAt: Date.now() })); }
    catch { setMessage("This browser can’t keep a temporary draft. Keep this tab open until you save your plan."); }
  }, [ready, draft, fare, stay, storageKey, loadedStorageKey]);

  useEffect(() => {
    if (!stay) return;
    setClock(Date.now());
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(0, Date.parse(stay.quote.expiresAt) - Date.now()) + 25);
    return () => window.clearTimeout(timer);
  }, [stay]);

  function change(patch: Partial<CarePlanDraft>) {
    generation.current++; setDraft((current) => ({ ...current, ...patch, flightId: null, stayQuoteId: null }));
    setFare(null); setStay(null); setFlights([]); setStays([]); setSearchedFlights(false); setSearchedStays(false); setAccepted(false); setError(""); setMessage(""); setBusy(null); requestAttempt.current = crypto.randomUUID();
  }
  async function search(kind: "flights" | "stays") {
    const version = ++generation.current; setBusy(kind); setError(""); setMessage("");
    try {
      if (kind === "flights") {
        const result = await api<{ fares: Fare[] }>("/api/explore/flights", { offerId: offer.id, from: draft.from, out: draft.out, back: draft.back, travellers: draft.travellers });
        if (version !== generation.current) return;
        setFlights(result.fares); setSearchedFlights(true); setFare(null); setDraft((d) => ({ ...d, flightId: null }));
      } else {
        const result = await api<{ stays: PublicStayOption[] }>("/api/explore/stays", { offerId: offer.id, out: draft.out, back: draft.back, travellers: draft.travellers });
        if (version !== generation.current) return;
        setStays(result.stays); setSearchedStays(true); setStay(null); setDraft((d) => ({ ...d, stayQuoteId: null }));
      }
      setAccepted(false); requestAttempt.current = crypto.randomUUID();
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "Search is unavailable."); }
    finally { if (version === generation.current) setBusy(null); }
  }
  async function save() {
    const version = generation.current; setBusy("save"); setError(""); setMessage("");
    try {
      const result = await api<{ plan: SavedCarePlan }>("/api/explore/plans", { ...(saved ? { id: saved.id, revision: saved.revision } : {}), draft }, "PUT");
      if (version !== generation.current) return;
      setSaved(result.plan); setMessage("Plan saved to your account. No clinic was contacted and no travel was reserved.");
      history.replaceState(null, "", `/explore/trip?offer=${encodeURIComponent(offer.id)}&plan=${encodeURIComponent(result.plan.id)}`);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "Saving is unavailable."); }
    finally { if (version === generation.current) setBusy(null); }
  }
  async function requestCare() {
    if (!savedCurrent || !saved || !accepted) return;
    const version = generation.current; setBusy("request"); setError("");
    try {
      const result = await api<{ request: { message: string } }>("/api/explore/requests", { planId: saved.id, revision: saved.revision, attemptId: requestAttempt.current });
      if (version === generation.current) { setMessage(result.request.message); setAccepted(false); }
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : "The sample request is unavailable."); }
    finally { if (version === generation.current) setBusy(null); }
  }
  const selectFlight = (item: Fare) => { setFare(item); setDraft((d) => ({ ...d, flightId: item.id })); setAccepted(false); requestAttempt.current = crypto.randomUUID(); };
  const selectStay = (item: PublicStayOption) => { setStay(item); setDraft((d) => ({ ...d, stayQuoteId: item.quote.quoteId })); setAccepted(false); requestAttempt.current = crypto.randomUUID(); };

  return <main className="planner-shell" aria-busy={!ready}>
    <Link className="planner-back" href="/explore">← Back to care search</Link>
    <div className="planner-heading"><div><p className="h-kicker">YOUR CARE + TRAVEL PLAN</p><h1>Bring it together.</h1><p>Add flights and a nearby stay to the treatment you’re exploring. Start with care, add what you need.</p></div><span className="planner-mode">Sample experience · nothing booked</span></div>
    <div className="planner-layout"><div className="planner-sections">
      <section className="planner-section" aria-labelledby="planner-care-title"><div className="planner-step">01 <span>Your care</span></div><h2 id="planner-care-title">{treatment?.name ?? "Care option"} in {offer.city}</h2><p>{offer.providerName} · verified listing</p><p>{offer.description}</p><div className="planner-care-grid"><div><strong>Included in the provider estimate</strong><ul>{offer.inclusions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>To confirm separately</strong><ul>{offer.exclusions.map((item) => <li key={item}>{item}</li>)}</ul></div></div><p className="planner-note">Treatment availability, suitability and timing require a clinician’s review. Selecting travel dates does not confirm an appointment or clearance to fly.</p></section>
      <section className="planner-section" aria-labelledby="planner-travel-title"><div className="planner-step">02 <span>Your travel details</span><small>Optional</small></div><h2 id="planner-travel-title">Make room for your trip.</h2><p>These dates are for travel planning. Sample flights use fixed local offsets and do not represent live airline schedules.</p><fieldset className="planner-fields" disabled={!ready || !!busy}><label className="label">Flying from<select className="field" value={draft.from} onChange={(e) => change({ from: e.target.value })}><option value="">Choose an airport</option>{SAMPLE_AIRPORTS.filter((code) => code !== offer.airport).map((code) => <option value={code} key={code}>{cityNames[code] ?? code} ({code})</option>)}</select></label><label className="label">Outbound date<input className="field" type="date" min={new Date().toISOString().slice(0, 10)} value={draft.out} onChange={(e) => change({ out: e.target.value })} /></label><label className="label">Return date<input className="field" type="date" min={draft.out || new Date().toISOString().slice(0, 10)} value={draft.back} onChange={(e) => change({ back: e.target.value })} /></label><label className="label">Travellers<select className="field" value={draft.travellers} onChange={(e) => change({ travellers: Number(e.target.value) })}>{Array.from({ length: 9 }, (_, i) => <option value={i + 1} key={i}>{i + 1} {i ? "adults" : "adult"}</option>)}</select></label></fieldset><p className="planner-note">This sample planner supports adults only and trips of 1–99 nights within 330 days. Travel is optional; you can save a treatment-only plan.</p></section>
      <section className="planner-section" aria-labelledby="planner-flights-title"><div className="planner-step">03 <span>Flights</span><small>Optional</small></div><div className="planner-section-title"><div><h2 id="planner-flights-title">A flight that fits your plan.</h2><p>Return flights to {offer.city} ({offer.airport}) · prices for {draft.travellers === 1 ? "one adult" : `all ${draft.travellers} adults`}.</p></div><button className="btn btn-outline" disabled={!ready || !!busy || !datesReady || !draft.from} onClick={() => void search("flights")}>{busy === "flights" ? "Searching…" : "Compare sample flights"}</button></div>{draft.flightId && !fare && <p className="planner-note">A flight was saved previously. Search again to review its current sample details.</p>}{fare && <div className="planner-selection" role="status"><span>Selected return flights · {money(fare.totalAmount)}</span><button className="link-btn" onClick={() => { setFare(null); setDraft((d) => ({ ...d, flightId: null })); setAccepted(false); }}>Remove</button></div>}{searchedFlights && !flights.length && <p role="status">No sample flights match these dates. Try a different airport or a longer trip.</p>}<div className="planner-results">{flights.map((item, index) => <article className={`planner-result${draft.flightId === item.id ? " is-selected" : ""}`} key={item.id}><div className="planner-result-top"><span className="planner-result-label">{index === 0 ? "Lowest sample fare" : `${item.slices.reduce((n, slice) => n + slice.segments.length - 1, 0)} stops round trip`}</span><strong>{money(item.totalAmount)}</strong></div>{item.slices.map((slice, n) => <div className="planner-flight-leg" key={n}><strong>{n === 0 ? "Outbound" : "Return"} · {dateLabel(slice.segments[0].departAt.slice(0, 10))}</strong><span>{slice.from} {slice.segments[0].departAt.slice(11, 16)} → {slice.to} {slice.segments.at(-1)!.arriveAt.slice(11, 16)}</span><small>{slice.segments.length === 1 ? "Direct sample itinerary" : `Via ${slice.segments[0].to}`} · local times</small></div>)}<details><summary>Fare details</summary><p>{item.conditions?.refund}</p><p>{item.conditions?.change}</p><p>USD · sample fare includes airline taxes. Baggage and optional airline services require confirmation.</p></details><button className="btn btn-outline" aria-pressed={draft.flightId === item.id} onClick={() => selectFlight(item)}>{draft.flightId === item.id ? "Selected" : "Add to plan"}</button></article>)}</div></section>
      <section className="planner-section" aria-labelledby="planner-stays-title"><div className="planner-step">04 <span>Stay nearby</span><small>Optional</small></div><div className="planner-section-title"><div><h2 id="planner-stays-title">Somewhere to settle in.</h2><p>Sample accommodation near the provider · {Math.ceil(draft.travellers / 2)} {draft.travellers > 2 ? "rooms" : "room"}.</p></div><button className="btn btn-outline" disabled={!ready || !!busy || !datesReady} onClick={() => void search("stays")}>{busy === "stays" ? "Searching…" : "Compare sample stays"}</button></div>{draft.stayQuoteId && !stay && <p className="planner-note">A stay was saved previously. Search again for a fresh sample quote before sending a request.</p>}{stay && <div className="planner-selection" role="status"><span>{stay.name} · {money(stay.quote.amount)}{quoteExpired ? " · quote expired" : ""}</span><button className="link-btn" onClick={() => { setStay(null); setDraft((d) => ({ ...d, stayQuoteId: null })); setAccepted(false); }}>Remove</button></div>}{searchedStays && !stays.length && <p role="status">No sample stays match these details. Try different dates.</p>}<div className="planner-results planner-stay-results">{stays.map((item) => <article className={`planner-result${draft.stayQuoteId === item.quote.quoteId ? " is-selected" : ""}`} key={item.quote.quoteId}><span className="planner-result-label">{item.distanceKm} km from the sample provider</span><h3>{item.name}</h3><strong className="planner-price">{money(item.quote.amount)} <small>whole stay</small></strong><p>Due at property: {item.quote.dueAtAccommodation === null ? "not yet known · excluded from total" : money(item.quote.dueAtAccommodation)}</p><p>{item.mobility === true ? "Sample step-free access" : item.mobility === false ? "Step-free access not offered" : "Accessibility not confirmed"}</p><details><summary>Conditions and quote</summary><p>{item.quote.conditions.join(" ")}</p><p>Sample quote valid for 10 minutes. Confirm accessibility directly before booking.</p></details><button className="btn btn-outline" aria-pressed={draft.stayQuoteId === item.quote.quoteId} onClick={() => selectStay(item)}>{draft.stayQuoteId === item.quote.quoteId ? "Selected" : "Add to plan"}</button></article>)}</div></section>
    </div><aside className="planner-summary" aria-labelledby="planner-summary-title"><div className="planner-currency"><p className="h-kicker">YOUR ESTIMATE</p><CurrencyMenu note="Illustrative exchange rates. Saved estimates remain in USD; this display is not a settlement quote." /></div><h2 id="planner-summary-title">One clearer picture.</h2><p>{treatment?.name} · {offer.city}</p><dl>{estimate.items.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.amountUsd === null ? "To confirm" : money(item.amountUsd)}</dd></div>)}</dl><div className="planner-total"><span>Known planning subtotal</span><strong>{money(estimate.knownTotalUsd)}</strong><small>{cur.code} · {estimate.complete ? "for the items shown" : "excludes unconfirmed costs"}</small></div>{!draft.flightId && <p className="planner-note">Flights are not selected and are excluded.</p>}{!draft.stayQuoteId && <p className="planner-note">Accommodation is not selected and is excluded.</p>}{estimate.unknownComponents.length > 0 && <p className="planner-note">Not included in subtotal: {estimate.unknownComponents.join(", ")}.</p>}<p className="planner-note">Travel prices and exchange rates are illustrative; this is not a payable quote. Totals may differ slightly from rounded display amounts. Medical extras, optional travel services and insurance may cost more.</p>{error && <p className="planner-error" role="alert">{error}</p>}{message && <p className="planner-message" role="status">{message}</p>}{!userId ? <><Link className="btn btn-primary" href={loginHref}>Sign in to save plan</Link><p className="planner-note">Your sample choices stay on this device while you sign in.</p></> : <><button className="btn btn-primary" disabled={!ready || loadedStorageKey !== storageKey || !!busy || quoteExpired} onClick={() => void save()}>{busy === "save" ? "Saving…" : savedCurrent ? "Save plan again" : "Save plan"}</button><div className="planner-request"><label><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={!savedCurrent || !!busy} /><span>I understand this is a sample request. It will not contact a clinic, confirm treatment or reserve travel.</span></label><button className="btn btn-outline" disabled={!savedCurrent || !accepted || !!busy || quoteExpired || (!!draft.flightId && !fare) || (!!draft.stayQuoteId && !stay)} onClick={() => void requestCare()}>{busy === "request" ? "Recording…" : "Send sample care request"}</button>{!savedCurrent && <p className="planner-note">Save your latest choices before sending a sample request.</p>}</div><Link className="planner-back" href="/account">View saved care plans →</Link></>}</aside></div>
    <a className="planner-mobile-summary" href="#planner-summary-title" aria-label="Review plan and planning subtotal"><span><small>Known planning subtotal · {cur.code}</small><strong>{money(estimate.knownTotalUsd)}</strong><small>{estimate.complete ? "Selected items only · nothing booked" : "Unconfirmed costs excluded"}</small></span><span className="planner-mobile-review">Review plan ↑</span></a>
  </main>;
}
