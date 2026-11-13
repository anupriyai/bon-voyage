"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
interface Row { id: string; status: string; total: string; currency: string; provider: string; bookingReference: string | null; payBy: string | null; voidWindowEndsAt: string | null; scheduleChanged: boolean; details: Record<string, unknown> }
const price = (b: Row) => new Intl.NumberFormat("en-US", { style: "currency", currency: b.currency }).format(Number(b.total));
export function BookingPanel({ caseId, refresh = 0 }: { caseId: string; refresh?: number }) {
  const identity = useRef(caseId); identity.current = caseId;
  const [rows, setRows] = useState<Row[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch(`/api/travel/book?caseId=${caseId}`, { cache: "no-store" }); if (identity.current !== caseId) return; if (response.ok) { setRows((await response.json()).bookings); setError(""); } else setError("Booking details are unavailable. Your saved plan remains available."); }, [caseId]);
  useEffect(() => { let active = true; if (active) void load().catch(() => setError("Booking details are unavailable.")); return () => { active = false; }; }, [load, refresh]);
  async function action(row: Row, kind: "reconcile" | "cancel" | "pay") {
    if (kind === "pay" && !window.confirm(`Pay ${price(row)} from the ${row.provider === "mock" ? "sample" : "test"} balance for this hold?`)) return;
    if (kind === "cancel" && !window.confirm("Record a request for a coordinator to contact Duffel support? This does not cancel the booking automatically.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/travel/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind, bookingId: row.id, ...(kind === "pay" ? { expectedAmount: Number(row.total), currency: row.currency, paymentAttemptId: crypto.randomUUID() } : {}) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error === "price_changed" ? "The price or schedule changed. Refresh and ask your coordinator to review before paying." : "This action could not be completed. Refresh the booking before trying again."); }
      await load();
    } catch (e) { setError(e instanceof TypeError ? "Booking is unavailable. Check your connection, then refresh the booking before trying again." : e instanceof Error ? e.message : "Booking is unavailable."); } finally { setBusy(false); }
  }
  return <section style={{ marginTop: 28 }}><h2 style={{ fontSize: 24 }}>Flight bookings</h2>
    {error && <p role="alert">{error}</p>}
    {!rows.length && !error && <p>No flight booking has been made. <Link href="/case/flights">Compare flights</Link>.</p>}
    {rows.map((b) => <article key={b.id} className="card-d" style={{ marginTop: 12 }}>
      <p className="eyebrow">{b.provider === "mock" ? "Sample booking" : "Duffel test booking"}</p>
      <h3>{b.status.replaceAll("_", " ")} · {price(b)}</h3>
      {Array.isArray(b.details.itinerary) && (b.details.itinerary as { from: string; to: string; segments: { carrierName?: string; carrier: string; flightNumber: string; departAt: string }[] }[]).map((slice, i) => <p key={i}>{slice.from} → {slice.to}: {slice.segments.map((segment) => `${segment.carrierName ?? segment.carrier} ${segment.flightNumber}, ${segment.departAt}`).join("; ")} · airport local times</p>)}
      {b.bookingReference && <p>Airline reference: <strong>{b.bookingReference}</strong></p>}
      {(b.status === "checking" || b.status === "creating" || b.status === "payment_checking") && <p>We’re checking your booking. Please keep this attempt; submitting a new booking can create a duplicate.</p>}
      {b.payBy && <p>Pay by {new Date(b.payBy).toLocaleString()} (your local time). A hold is not a paid ticket.</p>}
      {b.voidWindowEndsAt && <p>Provider cancellation window ends {new Date(b.voidWindowEndsAt).toLocaleString()}. Ask the coordinator to confirm eligibility.</p>}
      {b.scheduleChanged && <p role="alert">The airline changed the schedule. Your coordinator needs to review it before payment or travel.</p>}
      {b.details.assistance === true && <p>Coordinator task: request airline assistance using the booking reference, usually at least 48 hours before departure.</p>}
      {b.status === "cancel_requested" && <p>Manual cancellation requested. Your coordinator must contact Duffel support and confirm the outcome.</p>}
      <div className="actions"><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { void action(b, "reconcile"); }}>Refresh booking</button>
      {b.status === "held" && <button type="button" className="btn btn-primary btn-sm" disabled={busy || b.scheduleChanged} onClick={() => { void action(b, "pay"); }}>Pay hold · {price(b)}</button>}
      {["held", "confirmed"].includes(b.status) && <button type="button" className="link-btn" disabled={busy} onClick={() => { void action(b, "cancel"); }}>Request manual cancellation</button>}</div>
    </article>)}
  </section>;
}
