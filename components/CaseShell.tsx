"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { COORDINATOR } from "@/lib/data";
import { caseTitle, managedLine } from "@/lib/engine";
import { recordProgress, useCase } from "@/lib/store";
import CoordinatorChat from "./CoordinatorChat";
import FlowHeader from "./FlowHeader";
import { ChatIcon, CheckIcon } from "./Icons";

const TABS = [
  { href: "/case/about", label: "About the case" },
  { href: "/case/records", label: "Records" },
  { href: "/case/second-opinion", label: "Second opinion" },
  { href: "/case/options", label: "Options" },
  { href: "/case/plan", label: "Plan" },
  { href: "/case/dashboard", label: "Dashboard" },
];

export default function CaseShell({ children }: { children: ReactNode }) {
  const { state, ready, openChat } = useCase();
  const path = usePathname();

  if (!ready) {
    return (
      <>
        <FlowHeader />
        <main className="container case-main" aria-busy="true">
          <div className="wiz-skeleton" />
        </main>
      </>
    );
  }

  if (!state.complete) {
    return (
      <>
        <FlowHeader exitLabel="Back to home" />
        <main className="container case-main">
          <div className="empty-state">
            <h1>No case yet</h1>
            <p>Answer a few questions about the situation and we will build the case from there.</p>
            <Link href="/start" className="btn btn-primary">
              Start a care request
            </Link>
          </div>
        </main>
      </>
    );
  }

  const progress = recordProgress(state, new Date());
  const done: Record<string, boolean> = {
    "/case/about": true,
    "/case/records": progress.missing === 0 && progress.translating === 0,
    "/case/second-opinion": !!state.secondOpinionAt,
    "/case/options": !!state.chosenId,
    "/case/plan": !!state.planApprovedAt,
    "/case/dashboard": false,
  };

  return (
    <>
      <FlowHeader />
      <div className="case-top">
        <div className="container case-top-inner">
          <div>
            <p className="case-eyebrow">Case</p>
            <h1 className="case-title">{caseTitle(state.intake)}</h1>
            <p className="case-sub">{managedLine(state.intake)}</p>
          </div>
          <button type="button" className="btn btn-outline-dark" onClick={() => openChat()}>
            <ChatIcon width={18} height={18} />
            &nbsp;{COORDINATOR.name}, your coordinator
          </button>
        </div>
        <nav className="container tabs" aria-label="Case steps">
          {TABS.map((t, i) => {
            const current = path === t.href;
            const isDone = done[t.href] && !current;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`tab${current ? " is-current" : ""}${isDone ? " is-done" : ""}`}
                aria-current={current ? "page" : undefined}
              >
                <span className="tab-num">{isDone ? <CheckIcon width={12} height={12} /> : i + 1}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="container case-main">{children}</main>
      <p className="container sample-note">
        Prototype — specialists, hospitals, prices and visa rules shown here are illustrative sample data. No payment is
        taken and nothing is booked with a real provider.
        {state.sample && " You are viewing a sample case."}
      </p>
      <CoordinatorChat />
    </>
  );
}
