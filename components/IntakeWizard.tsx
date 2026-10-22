"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BUDGETS,
  CONTACT_VIA,
  DESTINATIONS,
  DIAGNOSES,
  INSURANCE,
  LANGUAGES,
  ORIGINS,
  RELATIONSHIPS,
  STAGES,
  TIMELINES,
  type Intake,
} from "@/lib/data";
import { caseTitle } from "@/lib/engine";
import { useCase } from "@/lib/store";
import { MultiChoice, SingleChoice } from "./Choices";
import FlowHeader from "./FlowHeader";
import PriorityRanker from "./PriorityRanker";

const TOTAL = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLES = [
  "About the patient",
  "What is the diagnosis?",
  "Home and languages",
  "What matters most to you?",
  "Budget, insurance and where to go",
];

type SetIntake = (p: Partial<Intake>) => void;

function validate(step: number, i: Intake): string | null {
  switch (step) {
    case 1: {
      if (!i.forWhom) return "Choose who this care is for.";
      if (!i.patientName.trim()) return i.forWhom === "self" ? "Add your name." : "Add the patient's name.";
      const age = Number(i.age);
      if (!i.age || !Number.isFinite(age) || age < 0 || age > 120) return "Add an age between 0 and 120.";
      if (!EMAIL_RE.test(i.email.trim())) return "Add an email address we can reach you on, like name@example.com.";
      if (i.forWhom === "family") {
        if (!i.managerName.trim()) return "Add your name so we know who manages the case.";
        if (!i.relationship) return "Choose how you are related to the patient.";
      }
      return null;
    }
    case 2:
      if (!i.diagnosis) return "Choose the diagnosis, or “Another type”.";
      if (!i.stage) return "Choose a stage, or “Not sure”.";
      return null;
    case 3:
      if (!i.origin) return "Choose where the patient lives now.";
      if (i.languages.length === 0) return "Choose at least one language.";
      return null;
    case 5:
      if (!i.budget) return "Choose a rough budget, or “Not sure yet”.";
      if (!i.insurance) return "Choose an insurance situation, or “Not sure”.";
      if (!i.timeline) return "Choose when you would like to start.";
      if (i.destinations.length === 0) return "Choose at least one place you would consider.";
      return null;
    default:
      return null;
  }
}

function StepOne({ i, set }: { i: Intake; set: SetIntake }) {
  const family = i.forWhom === "family";
  return (
    <>
      <div className="q">
        <h3 className="q-title">Who is this care for?</h3>
        <SingleChoice
          label="Who is this care for?"
          value={i.forWhom}
          onChange={(v) => set({ forWhom: v })}
          options={[
            { id: "self", label: "For myself" },
            { id: "family", label: "For a family member" },
          ]}
        />
      </div>

      <div className="fld-row">
        <label className="fld">
          <span>{i.forWhom === "self" ? "Your name" : "Patient's name"}</span>
          <input
            type="text"
            value={i.patientName}
            autoComplete="off"
            placeholder="First and last name"
            onChange={(e) => set({ patientName: e.target.value })}
          />
        </label>
        <label className="fld">
          <span>{i.forWhom === "self" ? "Your age" : "Patient's age"}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={i.age}
            placeholder="e.g. 68"
            onChange={(e) => set({ age: e.target.value })}
          />
        </label>
      </div>

      <div className="q">
        <h3 className="q-title">How can we reach you?</h3>
        <p className="q-help">
          We only use this to follow up on this request, for example to send your options or ask a question.
        </p>
        <div className="fld-row fld-row-even">
          <label className="fld">
            <span>Your email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={i.email}
              placeholder="name@example.com"
              onChange={(e) => set({ email: e.target.value })}
            />
          </label>
          <label className="fld">
            <span>Phone or WhatsApp (optional)</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={i.phone}
              placeholder="+962 7 1234 5678"
              onChange={(e) => set({ phone: e.target.value })}
            />
          </label>
        </div>
        <p className="q-sub">Best way to reach you (optional)</p>
        <SingleChoice
          label="Best way to reach you"
          value={i.contactVia}
          onChange={(v) => set({ contactVia: v })}
          options={CONTACT_VIA}
        />
      </div>

      {family && (
        <>
          <label className="fld">
            <span>Your name</span>
            <input
              type="text"
              value={i.managerName}
              autoComplete="given-name"
              placeholder="The person managing the case"
              onChange={(e) => set({ managerName: e.target.value })}
            />
          </label>
          <div className="q">
            <h3 className="q-title">How are you related to the patient?</h3>
            <SingleChoice
              label="Relationship to the patient"
              value={RELATIONSHIPS.includes(i.relationship) ? (i.relationship as string) : null}
              onChange={(v) => set({ relationship: v })}
              options={RELATIONSHIPS.map((r) => ({ id: r, label: r }))}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={i.patientSeesAll}
              onChange={(e) => set({ patientSeesAll: e.target.checked })}
            />
            <span>
              <strong>The patient can see everything in this case</strong>
              <small>You can change this at any time. Nothing is shared with a hospital without your say.</small>
            </span>
          </label>
        </>
      )}
    </>
  );
}

function StepTwo({ i, set }: { i: Intake; set: SetIntake }) {
  return (
    <>
      <p className="q-help">Use what the doctor told you. It&apos;s fine if you&apos;re not sure — specialists will confirm from the records.</p>
      <SingleChoice
        label="Diagnosis"
        value={i.diagnosis}
        onChange={(v) => set({ diagnosis: v })}
        options={DIAGNOSES}
      />
      {i.diagnosis === "other" && (
        <label className="fld">
          <span>What did the doctor call it? (optional)</span>
          <input
            type="text"
            value={i.diagnosisOther}
            placeholder="e.g. pancreatic cancer"
            onChange={(e) => set({ diagnosisOther: e.target.value })}
          />
        </label>
      )}
      <div className="q">
        <h3 className="q-title">Stage</h3>
        <SingleChoice label="Stage" value={i.stage} onChange={(v) => set({ stage: v })} options={STAGES} />
      </div>
    </>
  );
}

function StepThree({ i, set }: { i: Intake; set: SetIntake }) {
  return (
    <>
      <div className="q">
        <h3 className="q-title">Where does the patient live now?</h3>
        <SingleChoice label="Where the patient lives" value={i.origin} onChange={(v) => set({ origin: v })} options={ORIGINS} />
        {i.origin === "other" && (
          <label className="fld">
            <span>Which country? (optional)</span>
            <input
              type="text"
              value={i.originOther}
              placeholder="Country"
              onChange={(e) => set({ originOther: e.target.value })}
            />
          </label>
        )}
      </div>
      <div className="q">
        <h3 className="q-title">Languages the patient is comfortable with</h3>
        <p className="q-help">Choose all that apply.</p>
        <MultiChoice label="Languages" value={i.languages} onChange={(v) => set({ languages: v })} options={LANGUAGES} />
      </div>
    </>
  );
}

function StepFour({ i, set }: { i: Intake; set: SetIntake }) {
  return (
    <>
      <p className="q-help">
        Put these in order, most important first. We use this order to score every option, and you can change it later.
      </p>
      <PriorityRanker order={i.priorities} onChange={(priorities) => set({ priorities })} />
    </>
  );
}

function StepFive({ i, set }: { i: Intake; set: SetIntake }) {
  const allDest = DESTINATIONS.map((d) => d.id);
  const anywhere = allDest.every((d) => i.destinations.includes(d));
  return (
    <>
      <div className="q">
        <h3 className="q-title">Rough budget for medical costs</h3>
        <SingleChoice label="Budget" value={i.budget} onChange={(v) => set({ budget: v })} options={BUDGETS} />
      </div>
      <div className="q">
        <h3 className="q-title">Insurance situation</h3>
        <SingleChoice label="Insurance" value={i.insurance} onChange={(v) => set({ insurance: v })} options={INSURANCE} />
      </div>
      <div className="q">
        <h3 className="q-title">When would you like to start?</h3>
        <SingleChoice label="Timeline" value={i.timeline} onChange={(v) => set({ timeline: v })} options={TIMELINES} />
      </div>
      <div className="q">
        <h3 className="q-title">Where would you consider going?</h3>
        <p className="q-help">Choose all that apply.</p>
        <MultiChoice label="Destinations" value={i.destinations} onChange={(v) => set({ destinations: v })} options={DESTINATIONS} />
        <button
          type="button"
          className="link-btn"
          onClick={() => set({ destinations: anywhere ? [] : allDest })}
        >
          {anywhere ? "Clear all" : "Open to anywhere"}
        </button>
      </div>
    </>
  );
}

export default function IntakeWizard() {
  const { state, ready, update, setIntake, loadSample, resetCase } = useCase();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [inited, setInited] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ready || inited) return;
    const q = new URLSearchParams(window.location.search);
    const isEdit = q.get("edit") === "1";
    setEdit(isEdit);
    const wanted = Number(q.get("step"));
    if (wanted >= 1 && wanted <= TOTAL) setStep(wanted);
    else if (!state.complete) setStep(Math.min(Math.max(state.draftStep, 1), TOTAL));
    if (isEdit) setFresh(true);
    setInited(true);
  }, [ready, inited, state.complete, state.draftStep]);

  useEffect(() => {
    if (inited) heading.current?.focus({ preventScroll: true });
  }, [step, inited]);

  if (!ready || !inited) {
    return (
      <>
        <FlowHeader />
        <main className="wiz container" aria-busy="true">
          <div className="wiz-skeleton" />
        </main>
      </>
    );
  }

  // A finished case already exists: offer to continue it instead of silently overwriting it.
  if (state.complete && !edit && !fresh) {
    return (
      <>
        <FlowHeader exitLabel="Back to home" />
        <main className="wiz container">
          <div className="wiz-card resume">
            <p className="eyebrow eyebrow-dark">You have a case in progress</p>
            <h1 className="resume-title">{caseTitle(state.intake)}</h1>
            <p className="q-help">
              Pick up where you left off, or start a new request. Starting over clears the answers saved in this browser.
            </p>
            <div className="wiz-actions">
              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={() => {
                  resetCase();
                  setStep(1);
                  setFresh(true);
                }}
              >
                Start a new request
              </button>
              <Link href="/case/about" className="btn btn-primary">
                Open my case
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const intake = state.intake;
  const set: SetIntake = (p) => {
    setError(null);
    setIntake(p);
  };
  const go = (n: number) => {
    setStep(n);
    update((s) => (s.complete ? s : { ...s, draftStep: n }));
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const err = validate(step, intake);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < TOTAL) {
      go(step + 1);
      return;
    }
    update((s) => ({
      ...s,
      complete: true,
      createdAt: s.createdAt ?? new Date().toISOString(),
      draftStep: TOTAL,
      intake: {
        ...s.intake,
        managerName: s.intake.forWhom === "self" ? s.intake.patientName.trim() : s.intake.managerName.trim(),
        patientName: s.intake.patientName.trim(),
      },
    }));
    router.push(edit ? "/case/about" : "/case/records");
  };

  const back = () => {
    setError(null);
    if (step > 1) go(step - 1);
    else router.push(edit ? "/case/about" : "/");
  };

  const body =
    step === 1 ? (
      <StepOne i={intake} set={set} />
    ) : step === 2 ? (
      <StepTwo i={intake} set={set} />
    ) : step === 3 ? (
      <StepThree i={intake} set={set} />
    ) : step === 4 ? (
      <StepFour i={intake} set={set} />
    ) : (
      <StepFive i={intake} set={set} />
    );

  return (
    <>
      <FlowHeader />
      <main className="wiz container">
        <div className="wiz-head">
          <h1>Tell us about the situation</h1>
          <span className="wiz-step">
            Step {step} of {TOTAL}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step}
          aria-label="Progress"
        >
          <span style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>

        <section className="wiz-card" aria-labelledby="wiz-h">
          <h2 id="wiz-h" ref={heading} tabIndex={-1}>
            {TITLES[step - 1]}
          </h2>
          {body}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <div className="wiz-actions">
          <button type="button" className="btn btn-outline-dark" onClick={back}>
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={next}>
            {step < TOTAL ? "Continue" : edit ? "Save changes" : "Save and add records"}
          </button>
        </div>
        <p className="wiz-foot">Your answers are saved as you go.</p>
        {step === 1 && !edit && (
          <p className="wiz-foot">
            Just exploring?{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                loadSample();
                router.push("/case/about");
              }}
            >
              Open a sample case
            </button>
          </p>
        )}
      </main>
    </>
  );
}
