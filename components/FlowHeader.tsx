"use client";

import Link from "next/link";
import { useCase } from "@/lib/store";
import { LogoMark } from "./Icons";

export default function FlowHeader({ exitLabel = "Save and exit" }: { exitLabel?: string }) {
  const { session } = useCase();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <LogoMark />
          <span>Bon Voyage</span>
        </Link>
        <div className="header-actions">
          {session && <span className="header-email">{session.email}</span>}
          <Link href={session ? "/account" : "/"} className="btn btn-outline-dark btn-sm">
            {exitLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
