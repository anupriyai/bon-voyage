"use client";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/domains/providers/countries";
import type { ProfileData, ProfileView } from "../profile";
import AccountSection from "./AccountSection";

const initial = (): ProfileData => ({ displayName: "", accountKind: "patient", residenceCountry: "", preferredLanguage: "en", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", adultConfirmed: true });
const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
export default function ProfilePage() {
  const [view, setView] = useState<ProfileView | null>(null); const [form, setForm] = useState<ProfileData>(initial);
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState("Loading your profile…"); const [saving, setSaving] = useState(false);
  useEffect(() => { let cancelled = false; void fetch("/api/account/profile", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<ProfileView>; }).then((data) => { if (!cancelled) { setView(data); setForm(data.profile ?? { ...initial(), displayName: data.email.split("@")[0] }); setStatus(""); } }).catch(() => { if (!cancelled) setStatus("Your profile is temporarily unavailable. Reload to try again."); }); return () => { cancelled = true; }; }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!view) return; setSaving(true); setStatus("");
    try {
      const response = await fetch("/api/account/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: view.revision, profile: form }) });
      if (!response.ok) { const { error } = await response.json(); throw new Error(error === "verification_required" ? "Sign in again before changing your country." : error === "conflict" ? "Your profile changed in another tab. Reload before saving." : "Could not save your profile. Review your entries and try again."); }
      const next = await response.json() as ProfileView; setView(next); setForm(next.profile!); setStatus("Profile saved to your account.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Profile save unavailable."); }
    finally { setSaving(false); }
  }
  async function changeEmail(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setStatus("");
    try {
      const response = await fetch("/api/auth/change-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newEmail: newEmail.trim(), callbackURL: "/account/profile" }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error === "verification_required" ? "Sign in again before changing your email." : "Email change is unavailable."); }
      setNewEmail(""); setStatus("If the address can be used, a verification link has been sent there. Your current email remains active until verification.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Email change unavailable."); }
    finally { setSaving(false); }
  }
  return <AccountSection title="Your profile" intro="Your contact and planning preferences. Medical details belong in your private journey, not in this profile."><div className="account-panel"><form onSubmit={(event) => void save(event)} className="account-form"><label>Display name<input required maxLength={100} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label>Verified email<input readOnly value={view?.email ?? ""} /></label><label>I am<select value={form.accountKind} onChange={(event) => setForm({ ...form, accountKind: event.target.value as ProfileData["accountKind"] })}><option value="patient">A patient</option><option value="caregiver">A caregiver</option></select></label><p className="account-help">Caregiver profiles do not gain access to another person’s case.</p><label>Country or territory of residence<select required value={form.residenceCountry} onChange={(event) => setForm({ ...form, residenceCountry: event.target.value })}><option value="">Choose a country</option>{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label><label>Preferred language<select value={form.preferredLanguage} onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value })}><option value="en">English</option><option value="es">Español</option><option value="ar">العربية</option><option value="fr">Français</option></select></label><p className="account-help">The current interface is in English; this preference does not translate medical information.</p><label>Time zone<select value={form.timeZone} onChange={(event) => setForm({ ...form, timeZone: event.target.value })}>{zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label><label className="account-check"><input type="checkbox" checked={form.adultConfirmed} onChange={(event) => setForm({ ...form, adultConfirmed: event.target.checked as true })} />I confirm I am 18 or older.</label><button type="submit" className="btn btn-primary" disabled={!view || saving || !form.adultConfirmed}>{saving ? "Saving…" : "Save profile"}</button></form></div><div className="account-panel"><h2>Change email</h2><p>Verify the new address before it replaces your current sign-in email. A recent sign-in is required.</p><form onSubmit={(event) => void changeEmail(event)} className="account-form"><label>New email<input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><button type="submit" className="btn btn-outline" disabled={saving || !newEmail.trim()}>Send verification link</button></form>{status && <p role="status">{status}</p>}</div></AccountSection>;
}
