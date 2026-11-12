"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FlowBackdrop, SimpleBar, useCase } from "@/domains/case";
import AccountNav from "./AccountNav";

export default function AccountSection({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { ready, session } = useCase(); const router = useRouter();
  useEffect(() => { if (ready && !session) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`); }, [ready, session, router]);
  return <div className="flow"><FlowBackdrop /><SimpleBar /><main className="wrap flow-main" aria-busy={!ready || !session}><section className="flow-section account-section"><p className="eyebrow">Your account</p><h1>{title}</h1><p className="account-intro">{intro}</p><AccountNav />{ready && session ? children : <p role="status">Checking your account…</p>}</section></main></div>;
}
