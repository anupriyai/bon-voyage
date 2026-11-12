"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/domains/account/client";
import AccountSection from "./AccountSection";

type SessionRow = { id: string; token: string; createdAt: Date | string; expiresAt: Date | string; userAgent?: string | null };
type PasskeyRow = { id: string; name?: string | null; createdAt?: Date | string | null };
export default function SecurityPage() {
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = useState<SessionRow[]>([]); const [keys, setKeys] = useState<PasskeyRow[]>([]);
  const [message, setMessage] = useState("Loading security settings…"); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([authClient.listSessions(), authClient.passkey.listUserPasskeys()]);
    if (a.error || b.error) throw new Error("Security settings are temporarily unavailable.");
    setSessions((a.data ?? []) as SessionRow[]); setKeys((b.data ?? []) as PasskeyRow[]); setMessage("");
  }
  useEffect(() => { let active = true; void load().catch((error) => { if (active) setMessage(error.message); }); return () => { active = false; }; }, []);
  async function action(run: () => Promise<{ error?: { message?: string } | null }>, success: string) {
    setBusy(true); setMessage("");
    try { const result = await run(); if (result.error) throw new Error(result.error.message || "Action unavailable."); await load(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable."); }
    finally { setBusy(false); }
  }
  return <AccountSection title="Login & security" intro="Review the devices signed in to your account and add a passkey for easier, stronger sign-in."><div className="account-panel"><h2>Passkeys</h2><p>Passkeys use your device’s screen lock or security key. Keep your email access as a recovery path.</p><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void action(() => authClient.passkey.addPasskey({ name: "My passkey" }), "Passkey added.")}>Add a passkey</button><ul className="account-item-list">{keys.map((key) => <li key={key.id}><div><strong>{key.name || "Passkey"}</strong><small>{key.createdAt ? `Added ${new Date(key.createdAt).toLocaleDateString("en-US")}` : ""}</small></div><button type="button" className="link-btn" disabled={busy} onClick={() => void action(() => authClient.passkey.deletePasskey({ id: key.id }), "Passkey removed.")}>Remove</button></li>)}</ul>{!keys.length && <p>No passkeys added yet.</p>}</div><div className="account-panel"><h2>Signed-in devices</h2><p>End a session you no longer recognize. The current device is marked below.</p><ul className="account-item-list">{sessions.map((session) => <li key={session.id}><div><strong>{session.id === current?.session.id ? "This device" : "Another signed-in device"}</strong><small>{session.userAgent || "Device details unavailable"} · expires {new Date(session.expiresAt).toLocaleDateString("en-US")}</small></div>{session.id !== current?.session.id && <button type="button" className="link-btn" disabled={busy} onClick={() => void action(() => authClient.revokeSession({ token: session.token }), "Device signed out.")}>Sign out</button>}</li>)}</ul><button type="button" className="btn btn-outline" disabled={busy || sessions.length < 2} onClick={() => void action(() => authClient.revokeOtherSessions(), "Other devices signed out.")}>Sign out other devices</button></div><div className="account-panel"><h2>Fresh verification</h2><p>Changing your country, requesting account data, and downloading saved planning details require a sign-in from the last 10 minutes.</p><Link href="/login?next=/account/security" className="home-text-link">Verify with email or a passkey</Link>{message && <p role="status">{message}</p>}</div></AccountSection>;
}
