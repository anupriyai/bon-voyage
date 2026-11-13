"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCase } from "@/domains/case";
import { Arrow, Close, Logo, Menu } from "@/shared/ui/Icons";

const NAV = [["/explore", "Explore cancer care"], ["/destinations", "Destinations"], ["/treatments", "Cancer care topics"]] as const;
export function SiteHeader() {
  const path = usePathname();
  const { session } = useCase();
  const [menu, setMenu] = useState(false);
  const account = session ? "/account" : "/login";
  return <header className="home-header"><nav className="home-nav explore-site-nav" aria-label="Main">
    <Link href="/" className="brand" onClick={() => setMenu(false)}><Logo size={32} /><span>Bon Voyage</span></Link>
    <div className="home-nav-links">{NAV.map(([href, label]) => <Link href={href} key={href} aria-current={path === href ? "page" : undefined}>{label}</Link>)}</div>
    <div className="home-nav-actions"><Link href={account}>{session ? "My journeys" : "Log in"}</Link><Link href="/start" className="btn btn-primary">Start my journey <Arrow size={17} /></Link></div>
    <button type="button" className="home-menu-button pill-btn" aria-expanded={menu} aria-controls="home-menu" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu(!menu)}>{menu ? <Close /> : <Menu />}</button>
    {menu && <div id="home-menu" className="home-mobile-menu">{NAV.map(([href, label]) => <Link key={href} href={href} onClick={() => setMenu(false)}>{label}</Link>)}<Link href={account} onClick={() => setMenu(false)}>{session ? "My journeys" : "Log in"}</Link><Link href="/start" className="btn btn-primary">Start my journey</Link></div>}
  </nav></header>;
}
export function JourneyCTA() {
  return <section className="home-cta home-shell" data-reveal><div><p className="h-kicker">One step at a time</p><h2>Ready when you are.</h2><p>Start with your story. We’ll help connect what comes next.</p></div><Link href="/start" className="btn btn-primary">Start my journey <Arrow size={20} /></Link></section>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div className="home-shell site-footer-main">
    <div className="site-footer-brand"><Link href="/" className="brand"><Logo size={30} /><span>Bon Voyage</span></Link><p>Your care journey, connected.<br />Clearer options. A plan shaped around you.</p><Link href="/start" className="home-text-link">Start your journey <Arrow size={16} /></Link></div>
    <div><h2>Explore</h2><Link href="/explore">Cancer care directory</Link><Link href="/destinations">All destinations</Link><Link href="/treatments">Cancer care topics</Link><Link href="/how-it-works">How it works</Link><Link href="/about">About us</Link><Link href="/#faq">Common questions</Link></div>
    <div><h2>Your journey</h2><Link href="/start">Tell your story</Link><Link href="/account">Saved journeys</Link><Link href="/contact">Help & contact</Link><Link href="/privacy">Privacy & your information</Link></div>
  </div><div className="home-shell site-footer-bottom"><p>Bon Voyage · Care decisions belong to you and your clinicians.</p><p>Prototype · providers, care prices and visa examples are illustrative.</p></div></footer>;
}
