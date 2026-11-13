"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AccountSection from "./AccountSection";

type RequestRow = { id: string; kind: string; status: string; createdAt: string };
export default function DataPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]); const [message, setMessage] = useState("Loading your data options…"); const [busy, setBusy] = useState(false);
  const [eligibility, setEligibility] = useState<{ active: boolean; reason?: string; policyVersion?: string } | null>(null);
  async function load() {
    const [a, b] = await Promise.all([fetch("/api/account/data-requests", { cache: "no-store" }), fetch("/api/account/eligibility", { cache: "no-store" })]);
    if (!a.ok || !b.ok) throw new Error("Your data options are temporarily unavailable.");
    setRequests((await a.json()).requests); setEligibility(await b.json()); setMessage("");
  }
  useEffect(() => { let active = true; void load().catch((error) => { if (active) setMessage(error.message); }); return () => { active = false; }; }, []);
  async function download() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error === "verification_required" ? "Sign in again, then return here to download your data." : "Download unavailable."); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "bon-voyage-planning-data.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("Profile and saved planning data downloaded to this device. Keep the file private.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Download unavailable."); }
    finally { setBusy(false); }
  }
  async function request(kind: "access" | "correct" | "delete") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/data-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error === "verification_required" ? "Sign in again before making this request." : "Request unavailable."); }
      await load(); setMessage("Your request was recorded. It has not been completed automatically.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request unavailable."); }
    finally { setBusy(false); }
  }
  return <AccountSection title="My data" intro="See what the prototype stores, download the planning data available here, and record a data-rights request."><div className="account-panel"><h2>Health-data status</h2><p>{eligibility?.active ? "Your residence country has an active reviewed policy and your consent is recorded." : "Real patient-data intake is not open for your account. Use sample information only."}</p><p>Country availability and consent are separate from clinical suitability or provider availability.</p><Link href="/privacy" className="home-text-link">Read the current privacy information</Link></div><div className="account-panel"><h2>Download planning data</h2><p>This download includes your profile, saved guided cases, care plans and sample requests. It does not claim to include every operational or audit record.</p><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void download()}>Download my planning data</button></div><div className="account-panel"><h2>Request access, correction or deletion</h2><p>Requests are recorded for review. Nothing is deleted immediately; retention, booking and audit obligations must be assessed first. There is no staffed response team for this prototype yet.</p><div className="account-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => void request("access")}>Request full access</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => void request("correct")}>Request correction</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => void request("delete")}>Request deletion review</button></div><ul className="account-item-list">{requests.map((item) => <li key={item.id}><strong>{item.kind} request</strong><small>{item.status} · {new Date(item.createdAt).toLocaleDateString("en-US")}</small></li>)}</ul>{message && <p role="status">{message}</p>}</div></AccountSection>;
}
