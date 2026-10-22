"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BUDGETS,
  CONTACT_VIA,
  DESTINATIONS,
  DIAGNOSES,
  INSURANCE,
  LANG_LABEL,
  ORIGIN_BY_ID,
  PRIORITY_BY_ID,
  STAGES,
  TIMELINES,
} from "@/lib/data";
import { managedLine } from "@/lib/engine";
import { useCase } from "@/lib/store";

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <section className="card about-card">
      <div className="about-head">
        <h2>{title}</h2>
        <Link href={`/start?edit=1&step=${step}`} className="btn btn-outline-dark btn-sm">
          Edit
        </Link>
      </div>
      <dl className="facts">{children}</dl>
    </section>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function AboutPage() {
  const { state, resetCase } = useCase();
  const router = useRouter();
  const i = state.intake;
  const dx = DIAGNOSES.find((d) => d.id === i.diagnosis);
  const origin = i.origin ? ORIGIN_BY_ID[i.origin] : null;

  return (
    <div className="page">
      <h2 className="page-title">About the case</h2>
      <p className="page-lede">
        These answers shape every score and cost estimate. Change them any time and the options update.
      </p>

      <div className="about-grid">
        <Section title="The patient" step={1}>
          <Fact k="Name">{i.patientName}</Fact>
          <Fact k="Age">{i.age}</Fact>
          <Fact k="Managed by">{managedLine(i).replace(/^Managed by /, "")}</Fact>
          <Fact k="Email">{i.email}</Fact>
          {i.phone && <Fact k="Phone">{i.phone}</Fact>}
          {i.contactVia && <Fact k="Best way to reach you">{CONTACT_VIA.find((c) => c.id === i.contactVia)?.label}</Fact>}
        </Section>

        <Section title="Diagnosis" step={2}>
          <Fact k="Type">{dx?.id === "other" && i.diagnosisOther ? i.diagnosisOther : dx?.label}</Fact>
          <Fact k="Stage">{STAGES.find((s) => s.id === i.stage)?.label}</Fact>
        </Section>

        <Section title="Home and languages" step={3}>
          <Fact k="Lives in">
            {origin?.id === "other" && i.originOther ? i.originOther : origin?.label}
          </Fact>
          <Fact k="Languages">{i.languages.map((l) => LANG_LABEL[l]).join(", ")}</Fact>
        </Section>

        <Section title="Priorities, in order" step={4}>
          <ol className="priority-chips">
            {i.priorities.map((p, n) => (
              <li key={p} className="pill-soft">
                {n + 1}. {PRIORITY_BY_ID[p].label}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Budget and destinations" step={5}>
          <Fact k="Budget">{BUDGETS.find((b) => b.id === i.budget)?.label}</Fact>
          <Fact k="Insurance">{INSURANCE.find((b) => b.id === i.insurance)?.label}</Fact>
          <Fact k="Start">{TIMELINES.find((b) => b.id === i.timeline)?.label}</Fact>
          <Fact k="Would consider">
            {DESTINATIONS.filter((d) => i.destinations.includes(d.id))
              .map((d) => d.label)
              .join(", ")}
          </Fact>
        </Section>
      </div>

      <div className="page-actions">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            if (window.confirm("Start over? This clears the case saved in this browser.")) {
              resetCase();
              router.push("/start");
            }
          }}
        >
          Start over
        </button>
        <Link href="/case/records" className="btn btn-primary">
          Next: add medical records
        </Link>
      </div>
    </div>
  );
}
