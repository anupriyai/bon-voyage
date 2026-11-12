"use client";

import Link from "next/link";
import { useState } from "react";
import { STUDIO_ROUTES } from "./manifest";

const STATES = [
  { label: "Empty listing", text: "No listings yet. Clinics appear only after source review.", kind: "neutral" },
  { label: "Saving", text: "Saving your choices…", kind: "working" },
  { label: "Success", text: "Saved to your account.", kind: "success" },
  { label: "Error", text: "Could not save. Your choices are still on this device.", kind: "error" },
];
const GROUPS = ["Public", "Account", "Guided journey", "Developer"] as const;

export default function StudioPage() {
  const [selected, setSelected] = useState("/explore");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [query, setQuery] = useState("");
  const route = STUDIO_ROUTES.find((item) => item.path === selected)!;
  return <main className="studio-shell">
    <header className="studio-header">
      <div><p className="h-kicker">Private developer tool</p><h1>Bon Voyage QA studio</h1><p>Route coverage, safe previews and component states. No patient records or live credentials are loaded here.</p></div>
      <Link href="/" className="btn btn-outline">Back to site</Link>
    </header>
    <div className="studio-grid">
      <section className="studio-list" aria-label="Page inventory">
        <label>Find a page<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Route or page name" /></label>
        {GROUPS.map((group) => <div key={group}>
          <h2>{group}</h2>
          {STUDIO_ROUTES.filter((item) => item.group === group && `${item.title} ${item.path}`.toLowerCase().includes(query.toLowerCase())).map((item) =>
            <button key={item.path} type="button" aria-pressed={selected === item.path} className={selected === item.path ? "is-selected" : ""} onClick={() => setSelected(item.path)}><strong>{item.title}</strong><small>{item.path}</small></button>)}
        </div>)}
      </section>
      <section className="studio-preview" aria-labelledby="studio-preview-title">
        <div className="studio-preview-head"><div><p className="h-kicker">PAGE REVIEW</p><h2 id="studio-preview-title">{route.title}</h2><p>{route.state}</p></div><Link href={route.path} target="_blank" rel="noopener noreferrer">Open route ↗</Link></div>
        {route.preview ? <>
          <div className="studio-device-switch" role="group" aria-label="Preview width"><button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")}>Desktop</button><button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")}>Mobile</button></div>
          <div className="studio-frame-wrap"><iframe key={`${route.path}-${width}`} title={`${route.title} ${width} preview`} src={route.path} className={width === "mobile" ? "is-mobile" : ""} loading="lazy" /></div>
        </> : <div className="studio-locked"><h3>Open in an isolated fake-data session</h3><p>Private journey and account screens are never embedded here. Use the disposable QA database and a synthetic account to inspect them. Unverified offer routes remain unavailable.</p></div>}
        <div className="studio-components"><h2>Component states</h2><div className="studio-state-grid">
          {STATES.map((state) => <article key={state.label} data-kind={state.kind}><small>{state.label}</small><p>{state.text}</p></article>)}
          <article><small>Actions</small><p><button className="btn btn-primary" type="button">Primary action</button> <button className="btn btn-outline" type="button">Secondary action</button></p></article>
          <article><small>Form field</small><label>Country or territory<select defaultValue=""><option value="">Choose a country</option><option>Afghanistan</option><option>United States</option></select></label></article>
        </div></div>
        <div className="studio-components"><h2>Accessibility review</h2><p>Use Tab and Shift+Tab to inspect focus order; Enter and Space to activate controls. Check visible focus, form labels and status announcements. Review at 390px and 1440px, with reduced motion enabled. Public search drawers must return focus after closing.</p><h2>Synthetic test flows</h2><p>Run these from the repository with disposable PostgreSQL. They use fake accounts and sample data.</p><div className="studio-commands"><code>python3 tooling/testDatabase.py --command node tooling/smokeAccount.mjs</code><code>python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs --webpack</code></div></div>
      </section>
    </div>
  </main>;
}
