"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [["/account", "Journeys"], ["/account/profile", "Profile"], ["/account/security", "Security"], ["/account/data", "My data"]] as const;
export default function AccountNav() {
  const path = usePathname();
  return <nav className="account-tabs" aria-label="Account sections">{ITEMS.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
