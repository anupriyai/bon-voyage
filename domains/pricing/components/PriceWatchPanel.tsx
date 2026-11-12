"use client";
import { useCallback, useEffect, useRef, useState } from "react";
interface Watch { id: string; active: boolean; baseline: string | null; lowest: string | null; currency: string; lastCheckedAt: string | null }
interface Alert { id: string; from: string; to: string; currency: string; createdAt: string }
export function PriceWatchPanel({ caseId, searchId, offerId, beforeCreate }: { beforeCreate?: () => Promise<void>; caseId: string; searchId?: string; offerId?: string }) {
  const [data, setData] = useState<{ watches: Watch[]; alerts: Alert[] }>({ watches: [], alerts: [] }); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true); const loading = useRef<AbortController | null>(null); const changing = useRef(false);
  const load = useCallback(async () => {
    loading.current?.abort();
    const controller = new AbortController(); loading.current = controller;
    const response = await fetch(`/api/price-watch?caseId=${caseId}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("watch_load_failed");
    const next = await response.json();
    if (active.current && !controller.signal.aborted) setData(next);
  }, [caseId]);
  useEffect(() => {
    active.current = true;
    void load().catch((error) => { if (active.current && error?.name !== "AbortError") setMessage("We couldn’t load your price watches. Refresh this page to retry."); });
    return () => { active.current = false; loading.current?.abort(); };
  }, [load]);
  async function change(id?: string) {
    if (changing.current) return;
    changing.current = true; setBusy(true); setMessage(""); loading.current?.abort();
    try {
      if (!id) await beforeCreate?.();
      if (!active.current) return;
      const response = await fetch(id ? `/api/price-watch?id=${id}` : "/api/price-watch", { method: id ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, ...(!id ? { body: JSON.stringify({ caseId, searchId, offerId }) } : {}) });
      if (!response.ok) throw new Error();
      if (!active.current) return;
      await load();
      if (active.current) setMessage(id ? "Price watch stopped." : "Price watch saved. We’ll show qualifying drops here after a scheduled check.");
    } catch { if (active.current) setMessage("The price watch could not be updated. Search again and retry."); }
    finally { changing.current = false; if (active.current) setBusy(false); }
  }
  const money = (amount: string | null, currency: string) => amount === null ? "No fare seen" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
  return <section style={{ marginTop: 24 }}><h2 style={{ fontSize: 24 }}>Flight price watch</h2>
    <p>Watch the same return trip for airfare drops. Transfers and lodging estimates are separate. Changing your case or travel inputs stops its previous watch.</p>
    {searchId && offerId && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { void change(); }}>Watch this fare</button>}
    {message && <p role="status">{message}</p>}
    {data.watches.map((watch) => <p key={watch.id}>{watch.active ? "Watching" : "Stopped"} · baseline {money(watch.baseline, watch.currency)} · lowest seen {money(watch.lowest, watch.currency)} {watch.active && <button type="button" className="link-btn" disabled={busy} onClick={() => { void change(watch.id); }}>Stop</button>}</p>)}
    <ul>{data.alerts.map((alert) => <li key={alert.id}>Airfare dropped from {money(alert.from, alert.currency)} to {money(alert.to, alert.currency)} · {new Date(alert.createdAt).toLocaleDateString()}. Search again before booking.</li>)}</ul>
  </section>;
}
