"use client";

import Link from "next/link";
import { useCase } from "@/domains/case/state/store";
import CurrencyMenu from "@/shared/ui/CurrencyMenu";
import { Brand } from "@/domains/case/components/JourneyBar";

/** Top bar for pages outside a case: log in and the list of cases. */
export function SimpleBar() {
  const { session, logout } = useCase();
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Brand />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <CurrencyMenu />
          {session ? (
            <button type="button" className="pill-btn" onClick={logout}>
              Log out
            </button>
          ) : (
            <Link href="/" className="pill-btn">
              Home
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
