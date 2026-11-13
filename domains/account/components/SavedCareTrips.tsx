"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findPublicOffer, TREATMENTS, COUNTRIES, type SavedCarePlan, type CareRequest } from "@/domains/providers";
import { useCurrency } from "@/shared/lib/currency";
import { Arrow } from "@/shared/ui/Icons";

export default function SavedCareTrips({ accountId }: { accountId: string }) {
  const { money } = useCurrency();
  const [plans, setPlans] = useState<SavedCarePlan[]>([]);
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPlans([]); setRequests([]); setStatus("loading");
    void Promise.all([
      fetch("/api/explore/plans", { signal: controller.signal, cache: "no-store" }),
      fetch("/api/explore/requests", { signal: controller.signal, cache: "no-store" }),
    ]).then(async ([saved, submitted]) => {
      if (!saved.ok || !submitted.ok) throw new Error("unavailable");
      const [planData, requestData] = await Promise.all([saved.json(), submitted.json()]);
      if (!controller.signal.aborted) { setPlans(planData.plans); setRequests(requestData.requests); setStatus("ready"); }
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [accountId, attempt]);

  return <section className="saved-care-section" aria-labelledby="saved-care-title">
    <div className="saved-care-heading"><div><p className="eyebrow">Cancer care</p><h2 id="saved-care-title">Your saved care trips</h2></div><Link href="/explore" className="home-text-link">Explore cancer care <Arrow size={16} /></Link></div>
    {status === "loading" && <p role="status">Loading your saved care trips…</p>}
    {status === "error" && <p role="alert">Saved care trips are temporarily unavailable. <button className="link-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button></p>}
    {status === "ready" && !plans.length && <p className="card-d">No saved care trips yet. Browse treatments and destinations without starting a guided journey.</p>}
    <ul className="saved-care-list">{plans.map((plan) => {
      const offer = findPublicOffer(plan.draft.offerId);
      const treatment = TREATMENTS.find((item) => item.id === offer?.treatmentId);
      const country = COUNTRIES.find((item) => item.code === offer?.countryCode);
      const submitted = requests.filter((request) => request.planId === plan.id);
      return <li className="card-d saved-care-card" key={plan.id}><div><span className="pill pill-wait">{offer ? "Sample plan" : "Archived demo plan"}</span><h3>{treatment?.name ?? "Care trip"}{offer ? ` in ${offer.city}` : ""}</h3><p>{offer ? `${offer.providerName}${country ? ` · ${country.name}` : ""}` : "This earlier fictional listing is no longer available for planning."}</p><p>{plan.draft.out ? `${plan.draft.out} – ${plan.draft.back}` : "Dates flexible"} · {plan.draft.travellers} traveller{plan.draft.travellers === 1 ? "" : "s"}</p>{offer?.priceUsd != null && <p>Treatment estimate {money(offer.priceUsd)} · travel shown in your plan</p>}{submitted.length > 0 && <p className="saved-care-notice">Sample request recorded. No clinic was contacted and no travel was reserved.</p>}</div>{offer && <Link className="btn btn-outline" href={`/explore/trip?plan=${plan.id}&offer=${offer.id}`}>Open trip <Arrow size={16} /></Link>}</li>;
    })}</ul>
    {status === "ready" && requests.length > 0 && <><h3>Sample care requests</h3><ul className="saved-care-list">{requests.map((request) => {
      const offer = findPublicOffer(request.draft.offerId);
      const treatment = TREATMENTS.find((item) => item.id === offer?.treatmentId);
      return <li key={request.id} className="card-d"><strong>{treatment?.name ?? "Archived demo request"}</strong><p>{offer ? request.providerName : "Earlier fictional listing"} · saved {new Date(request.createdAt).toLocaleDateString("en-US")}</p><p className="saved-care-caption">{request.message}</p>{offer && <Link className="home-text-link" href={`/explore/trip?plan=${request.planId}&offer=${offer.id}`}>Open original trip <Arrow size={16} /></Link>}</li>;
    })}</ul></>}
  </section>;
}
