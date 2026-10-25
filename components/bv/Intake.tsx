"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiExtract, type AiSource } from "@/lib/ai";
import { PLACEHOLDERS, SAMPLE_STORY, STARTERS, countFound, extractStory, type Found } from "@/lib/assistant";
import {
  DEFAULT_PRIORITIES,
  DIAGNOSES,
  HOSPITALS,
  INSURANCE,
  LANGUAGES,
  ORIGINS,
  ORIGIN_BY_ID,
  PRIORITIES,
  STAGES,
  TIMELINES,
  hospitalsToRegions,
  recordsFor,
  regionsToHospitals,
  COORDINATOR,
  type BudgetId,
  type DxId,
  type HospitalId,
  type InsuranceId,
  type Intake as IntakeT,
  type LangId,
  type OriginId,
  type PriorityId,
  type StageId,
  type TimelineId,
} from "@/lib/data";
import { matchedOptions } from "@/lib/engine";
import { useCurrency } from "@/lib/currency";
import { coordinatorGreeting, resumePath, useCase } from "@/lib/store";
import { AssistantIdentity, useTyped, type OrbMode } from "./Assistant";
import { FlowBackdrop } from "./CaseShell";
import CurrencyMenu from "./CurrencyMenu";
import Globe from "./Globe";
import { Brand, PhaseList } from "./JourneyBar";
import { Arrow, Check, Lock, Mic, Sparkle } from "./icons";

type Step = "story" | "think" | "ask" | "brief" | "build";
type Qid = "who" | "diagnosis" | "stage" | "origin" | "languages" | "timeline" | "budget" | "insurance" | "priorities" | "destinations" | "contact";

/** Answers the person gave directly. They win over anything read from the story. */
interface Answers {
  forWhom?: "self" | "family";
  rel?: string;
  name?: string;
  age?: string;
  dx?: DxId;
  stage?: StageId;
  origin?: OriginId;
  originCity?: string;
  langs?: LangId[];
  time?: TimelineId;
  budget?: BudgetId;
  pay?: InsuranceId;
  mgr?: string;
  mgrRel?: string;
  prio?: PriorityId[];
  dest?: HospitalId[];
  email?: string;
  phone?: string;
}

interface Final {
  r: Found;
  forWhom: "self" | "family" | null;
  rel: string | null;
  name: string | null;
  age: string | null;
  dx: DxId | null;
  stage: StageId | null;
  origin: { v: OriginId; label: string; city: string } | null;
  langs: LangId[] | null;
  time: TimelineId | null;
  budget: BudgetId | null;
  pay: InsuranceId | null;
  mgr: string | null;
  mgrRel: string | null;
  prio: PriorityId[] | null;
  dest: HospitalId[] | null;
  email: string;
  phone: string;
}

function finalOf(r: Found, A: Answers): Final {
  const o = A.origin ? ORIGIN_BY_ID[A.origin] : null;
  const city = A.originCity || o?.city || "";
  return {
    r,
    forWhom: A.forWhom ?? (r.rel ? "family" : r.self ? "self" : null),
    rel: A.rel ?? r.rel?.v ?? null,
    name: A.name ?? r.name?.v ?? null,
    age: A.age ?? r.age?.v ?? null,
    dx: A.dx ?? r.dx?.v ?? null,
    stage: A.stage ?? r.stage?.v ?? null,
    origin: o ? { v: o.id, city, label: `${city}, ${o.label}` } : r.origin ? { v: r.origin.v, city: r.origin.city, label: r.origin.label } : null,
    langs: A.langs ?? r.langs?.v ?? null,
    time: A.time ?? r.time?.v ?? null,
    budget: A.budget ?? r.budget?.v ?? null,
    pay: A.pay ?? r.pay?.v ?? null,
    mgr: A.mgr ?? (r.mgr?.v || null),
    mgrRel: A.mgrRel ?? r.mgr?.rel ?? null,
    prio: A.prio ?? null,
    dest: A.dest ?? r.dest?.v ?? null,
    email: A.email ?? "",
    phone: A.phone ?? "",
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toIntake(F: Final): Partial<IntakeT> {
  return {
    forWhom: F.forWhom,
    patientName: F.forWhom === "self" && !F.name ? "You" : (F.name ?? ""),
    age: F.age ?? "",
    relationship: F.mgrRel ? cap(F.mgrRel) : "",
    patientRelation: F.rel ?? "",
    managerName: F.mgr ?? "",
    email: F.email,
    phone: F.phone,
    contactVia: "email",
    diagnosis: F.dx,
    stage: F.stage,
    origin: F.origin?.v ?? null,
    originCity: F.origin?.city ?? "",
    languages: F.langs ?? [],
    priorities: F.prio ?? [...DEFAULT_PRIORITIES],
    budget: F.budget,
    insurance: F.pay,
    destinations: F.dest ? hospitalsToRegions(F.dest) : [],
    timeline: F.time,
  };
}

function fromIntake(i: IntakeT): Answers {
  return {
    forWhom: i.forWhom ?? undefined,
    rel: i.patientRelation || undefined,
    name: i.patientName || undefined,
    age: i.age || undefined,
    dx: i.diagnosis ?? undefined,
    stage: i.stage ?? undefined,
    origin: i.origin ?? undefined,
    originCity: i.originCity || undefined,
    langs: i.languages.length ? i.languages : undefined,
    time: i.timeline ?? undefined,
    budget: i.budget ?? undefined,
    pay: i.insurance ?? undefined,
    mgr: i.managerName || undefined,
    mgrRel: i.relationship ? i.relationship.toLowerCase() : undefined,
    prio: i.priorities,
    dest: i.destinations.length ? regionsToHospitals(i.destinations, i.origin) : undefined,
    email: i.email || undefined,
    phone: i.phone || undefined,
  };
}

function missing(F: Final, editing: boolean): Qid[] {
  const out: Qid[] = [];
  if (!F.name && F.forWhom !== "self") out.push("who");
  if (!F.dx) out.push("diagnosis");
  if (!F.stage) out.push("stage");
  if (!F.origin) out.push("origin");
  if (!F.langs?.length) out.push("languages");
  if (!F.time) out.push("timeline");
  if (!F.budget) out.push("budget");
  if (!F.pay) out.push("insurance");
  out.push("priorities");
  if (!F.dest?.length) out.push("destinations");
  if (!editing) out.push("contact");
  return out;
}

const pf = (F: Final) => (F.forWhom === "self" ? "you" : F.name ? F.name.split(" ")[0] : "the patient");
const HOSP_LABELS = HOSPITALS.map((h) => ({ id: h.id, label: h.city }));
const labelOf = <T extends string>(list: { id: T; label: string }[], v: T | null | undefined) => list.find((x) => x.id === v)?.label ?? null;
const INSURANCE_BRIEF: Record<InsuranceId, string> = {
  self: "paying themselves",
  partial: "with insurance possibly covering part",
  program: "through a government or employer program",
  unsure: "with payment still to decide",
};

function qText(id: Qid, F: Final): [string, string] {
  const p = pf(F);
  const self = F.forWhom === "self";
  const T: Record<Qid, [string, string]> = {
    who: ["Who is this care for?", "I’ll keep everything in one private case under their name."],
    diagnosis: [self ? "What did your doctor say it is?" : `What did the doctor say ${p} has?`, "Use the doctor’s words if you have them. Specialists confirm from the records."],
    stage: ["Do you know the stage?", "It’s fine if you’re not sure. It only widens the cost range a little."],
    origin: [self ? "Where do you live now?" : `Where does ${p} live now?`, "I use this for travel times, entry rules and local scan prices."],
    languages: [self ? "Which languages are you comfortable with?" : `Which languages is ${p} comfortable with?`, "Choose all that apply. I’ll favour teams who speak them."],
    timeline: ["When would you like treatment to start?", "I’ll check how soon each hospital can see you."],
    budget: ["Roughly how much can you spend on medical costs?", "A rough range is enough. I flag options above it; I never hide them."],
    insurance: ["How will treatment be paid for?", "This changes which costs I show as out of pocket."],
    priorities: ["What matters most when choosing a hospital?", "Tap them in order of importance. I’ll score every option this way, and you can change it later."],
    destinations: [
      "Where would you consider going?",
      F.origin?.v === "jordan"
        ? `From ${F.origin.city}, Amman is a drive and Cairo is a short flight. I’ll compare whichever you pick.`
        : "I’ll compare whichever you pick, with travel time and entry rules for each.",
    ],
    contact: [self ? "Where should I send your options?" : `Where should I send ${p}’s options?`, "This also creates your private case. We’ll email a secure sign-in link, so there’s no password to remember (prototype)."],
  };
  return T[id];
}

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function Intake() {
  const router = useRouter();
  const { ready, state, hasActive, startDraft, setIntake, patch, signIn } = useCase();
  const { money, cur } = useCurrency();

  const [step, setStep] = useState<Step>("story");
  const [text, setText] = useState("");
  const [auto, setAuto] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [storyErr, setStoryErr] = useState(false);
  const [ph, setPh] = useState(0);
  const [ai, setAi] = useState<{ text: string; found: Found; source: AiSource } | null>(null);
  const [ans, setAns] = useState<Answers>({});
  const [queue, setQueue] = useState<Qid[]>([]);
  const [qi, setQi] = useState(0);
  const [editing, setEditing] = useState<Qid | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [rank, setRank] = useState<PriorityId[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [build, setBuild] = useState(0);
  const [gAct, setGAct] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(0);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const prevVals = useRef<Record<string, string>>({});
  const ver = useRef<Record<string, number>>({});

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 200) : ms));

  // Open the saved draft, or the finished case when editing the story from later steps.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const edit = new URLSearchParams(window.location.search).get("edit") === "1";
    if (edit && hasActive && state.complete) {
      setEditMode(true);
      setAns(fromIntake(state.intake));
      setStep("brief");
    } else {
      startDraft();
    }
  }, [ready, hasActive, state.complete, state.intake, startDraft]);

  useEffect(() => {
    const t = window.setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 3800);
    const pending = timers.current;
    return () => {
      window.clearInterval(t);
      pending.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  // "Speak instead" and the sample story type themselves in, like dictation.
  useEffect(() => {
    if (auto === null) return;
    if (text.length >= auto.length) {
      setAuto(null);
      setVoice(false);
      return;
    }
    const t = window.setTimeout(() => setText(auto.slice(0, reducedMotion() ? auto.length : text.length + 3)), 28);
    return () => window.clearTimeout(t);
  }, [auto, text]);

  const live = useMemo(() => extractStory(text), [text]);
  const found = ai && ai.text === text ? ai.found : live;
  const F = finalOf(found, ans);
  const storyFound = countFound(found);

  const persist = (next: Answers) => {
    setIntake(toIntake(finalOf(found, next)));
    setSaved((s) => s + 1);
  };

  const currentQ: Qid | undefined = editing ?? queue[qi];

  const enterQuestion = (i: number, q: Qid[], A: Answers) => {
    const id = q[i];
    const FF = finalOf(found, A);
    setQi(i);
    setEditing(null);
    setToast(null);
    setErr(null);
    setLocked(false);
    setMulti(id === "languages" ? (FF.langs ?? []) : id === "destinations" ? (FF.dest ?? []) : []);
    setRank(id === "priorities" ? (FF.prio ?? []) : []);
    setStep("ask");
  };

  const continueStory = async () => {
    if (text.trim().length < 12) {
      setStoryErr(true);
      return;
    }
    setStoryErr(false);
    setAuto(null);
    setVoice(false);
    setStep("think");
    const started = performance.now();
    const res = await aiExtract(text);
    setAi({ text, found: res.found, source: res.source });
    const FF = finalOf(res.found, ans);
    const q = missing(FF, false);
    setQueue(q);
    setIntake(toIntake(FF));
    later(() => enterQuestion(0, q, ans), Math.max(0, 2600 - (performance.now() - started)));
  };

  const reflect = (id: Qid, A: Answers): string => {
    const FF = finalOf(found, A);
    switch (id) {
      case "who":
        return `Thanks. I’ll keep everything under ${FF.forWhom === "self" ? "your" : (FF.name?.split(" ")[0] ?? "their") + "’s"} name.`;
      case "diagnosis":
        return `Noted: ${labelOf(DIAGNOSES, FF.dx)?.toLowerCase()}. I’ll look for matching specialists.`;
      case "stage":
        return `Noted: ${labelOf(STAGES, FF.stage)?.toLowerCase()}.`;
      case "origin":
        return `I’ll work out travel from ${FF.origin?.city ?? "there"}.`;
      case "languages":
        return `I’ll favour teams who speak ${(FF.langs ?? []).map((l) => labelOf(LANGUAGES, l)).join(" and ")}.`;
      case "timeline":
        return `Noted: ${labelOf(TIMELINES, FF.time)?.toLowerCase()}.`;
      case "budget":
        return FF.budget === "unsure" ? "No problem. I’ll show the full range." : `I’ll flag anything above ${budgetLabel(FF.budget)}.`;
      case "insurance":
        return FF.pay === "self" ? "I’ll show every cost as out of pocket." : "Noted. Your coordinator will check coverage.";
      case "priorities":
        return `${labelOf(PRIORITIES, FF.prio?.[0])} comes first. I’ll score options in that order.`;
      case "destinations":
        return FF.dest?.length === HOSPITALS.length ? "I’ll compare all five partner hospitals." : `I’ll focus on ${(FF.dest ?? []).map((d) => labelOf(HOSP_LABELS, d)).join(", ")}.`;
      case "contact":
        return `Your case will be saved to ${FF.email}.`;
    }
  };

  const answer = (id: Qid, p: Answers) => {
    if (locked) return;
    const next = { ...ans, ...p };
    setAns(next);
    persist(next);
    setToast({ text: reflect(id, next), n: (toast?.n ?? 0) + 1 });
    setLocked(true);
    setErr(null);
    later(() => {
      if (editing) {
        setEditing(null);
        setToast(null);
        setLocked(false);
        setStep("brief");
      } else if (qi + 1 < queue.length) enterQuestion(qi + 1, queue, next);
      else {
        setToast(null);
        setLocked(false);
        setStep("brief");
      }
    }, 1100);
  };

  const back = () => {
    if (editing) {
      setEditing(null);
      setToast(null);
      setStep("brief");
    } else if (qi > 0) enterQuestion(qi - 1, queue, ans);
    else {
      setToast(null);
      setStep("story");
    }
  };

  const editFromBrief = (id: Qid) => {
    setEditing(id);
    setToast(null);
    setErr(null);
    setLocked(false);
    setMulti(id === "languages" ? (F.langs ?? []) : id === "destinations" ? (F.dest ?? []) : []);
    setRank(id === "priorities" ? (F.prio ?? []) : []);
    setStep("ask");
  };

  const createCase = () => {
    const intake = toIntake(F);
    setIntake(intake);
    if (editMode) {
      router.push(resumePath({ ...state, intake: { ...state.intake, ...intake } }));
      return;
    }
    const greet = { from: "coordinator" as const, at: new Date().toISOString(), text: coordinatorGreeting(F.mgr ?? (F.forWhom === "self" ? F.name ?? "" : "")) };
    patch({ complete: true, createdAt: new Date().toISOString(), draftStep: 5, chat: [greet] });
    signIn(F.email);
    setStep("build");
    setBuild(0);
    const tick = (n: number) => {
      setBuild(n);
      if (n < 6) later(() => tick(n + 1), 1150);
    };
    later(() => tick(1), 600);
    const g = window.setInterval(() => setGAct((a) => (a + 1) % 5), 1700);
    timers.current.push(g);
  };

  /* ---------- prompt texts ---------- */
  let ackText = "";
  let titleText = "";
  if (step === "story") titleText = "Tell me what’s happening, in your own words.";
  if (step === "ask" && currentQ) {
    titleText = qText(currentQ, F)[0];
    if (editing) ackText = "Sure, let’s update that.";
    else if (qi === 0) {
      const sorry = F.forWhom === "family" && F.name ? `I’m sorry ${F.name.split(" ")[0]} is going through this. ` : "";
      ackText = storyFound > 0 ? `${sorry}I picked up ${storyFound} details from what you wrote, so I only need ${queue.length} more.` : "Let’s take it one step at a time. I’ll keep it short.";
    } else if (qi === queue.length - 1) ackText = "Last one.";
    else ackText = ["Thanks, that helps.", "Got it.", "Noted.", "Almost there."][qi % 4];
  }
  if (step === "brief") {
    ackText = editMode ? "Here’s the story your case is built on. Tap anything highlighted to change it." : "Take a look. Tap anything highlighted to change it.";
    titleText = "Here’s what I understood.";
  }
  const typed = useTyped(ackText, titleText);

  const listening = step === "story" && (!!auto || text.length > 0);
  const thinking = step === "think" || (step === "build" && build < 6) || locked;
  const status =
    step === "story"
      ? voice ? "Listening to you" : text ? "Reading as you type" : "Ready when you are"
      : step === "think" ? "Thinking"
      : step === "ask" ? (locked ? "Updating your brief" : "Asking only what I still need")
      : step === "brief" ? "Your brief is ready to review"
      : build < 6 ? "Building your case" : "Case ready";
  const mode: OrbMode = thinking ? "think" : listening ? "listen" : "idle";

  const budgets: { id: BudgetId; label: string }[] = [
    { id: "u25", label: `Under ${money(25000)}` },
    { id: "25-50", label: `${money(25000)}–${money(50000).replace(/^[^0-9]+/, "")}` },
    { id: "50-100", label: `${money(50000)}–${money(100000).replace(/^[^0-9]+/, "")}` },
    { id: "o100", label: `Over ${money(100000)}` },
    { id: "unsure", label: "Not sure yet" },
  ];
  function budgetLabel(b: BudgetId | null) {
    return budgets.find((x) => x.id === b)?.label ?? "";
  }

  /* ---------- live panel ---------- */
  const q = (k: keyof Found) => (found[k] as { q?: string } | undefined)?.q ?? "";
  const prioLabel = F.prio ? F.prio.slice(0, 2).map((p) => labelOf(PRIORITIES, p)).join(" → ") : null;
  const destLabel = F.dest?.length ? (F.dest.length === HOSPITALS.length ? "Open to anywhere" : F.dest.map((d) => labelOf(HOSP_LABELS, d)).join(", ")) : null;
  const dxShort = F.dx ? cap(labelOf(DIAGNOSES, F.dx)!.toLowerCase()) : null;
  const rows: { k: string; label: string; v: string | null; q: string }[] = [
    { k: "patient", label: "Patient", v: F.name ? F.name + (F.rel ? ` · ${F.rel}` : "") : F.forWhom === "self" ? "You" : null, q: q("name") || q("rel") },
    { k: "age", label: "Age", v: F.age, q: q("age") },
    { k: "dx", label: "Diagnosis", v: dxShort, q: q("dx") },
    { k: "stage", label: "Stage", v: labelOf(STAGES, F.stage), q: q("stage") },
    { k: "origin", label: "Lives in", v: F.origin?.label ?? null, q: q("origin") },
    { k: "lang", label: "Speaks", v: F.langs?.length ? F.langs.map((l) => labelOf(LANGUAGES, l)).join(", ") : null, q: q("langs") },
    { k: "time", label: "Wants to start", v: labelOf(TIMELINES, F.time), q: q("time") },
    { k: "budget", label: "Medical budget", v: F.budget ? budgetLabel(F.budget) : null, q: q("budget") },
    { k: "pay", label: "Paying", v: labelOf(INSURANCE, F.pay), q: q("pay") },
    { k: "mgr", label: "Managed by", v: F.mgr ? F.mgr + (F.mgrRel ? ` (${F.mgrRel})` : "") : F.forWhom === "self" ? "You" : null, q: q("mgr") },
    { k: "prio", label: "Matters most", v: prioLabel, q: "" },
    { k: "dest", label: "Considering", v: destLabel, q: q("dest") },
  ];
  for (const r of rows) {
    const val = r.v ?? "";
    if (prevVals.current[r.k] !== val) {
      prevVals.current[r.k] = val;
      if (val) ver.current[r.k] = (ver.current[r.k] ?? 0) + 1;
    }
  }
  const nFound = rows.filter((r) => r.v).length;
  const pct = Math.round((nFound / rows.length) * 100);

  /* ---------- build ---------- */
  const buildModel = useMemo(() => {
    if (step !== "build") return null;
    const intake = { ...state.intake, ...toIntake(F) } as IntakeT;
    const m = matchedOptions(intake);
    const totals = m.options.map((o) => o.totals.expected);
    const within = m.options.filter((o) => o.budget.status === "within");
    return { m, lo: Math.min(...totals), hi: Math.max(...totals), within, records: recordsFor(intake.diagnosis).length };
  }, [step]);

  const origin = F.origin ? ORIGIN_BY_ID[F.origin.v] : ORIGINS[0];
  const originLon = origin.lon ?? 35.85;
  const originLat = origin.lat ?? 32.55;
  const buildHosp = buildModel ? buildModel.m.options.map((o) => o.hospital) : HOSPITALS;
  const buildRoutes = buildHosp.map((h) => ({ a: [originLon, originLat] as [number, number], b: [h.lon, h.lat] as [number, number], aLabel: F.origin?.city ?? origin.city, bLabel: h.city }));
  const dxSurgeons = F.dx ? `${labelOf(DIAGNOSES, F.dx)!.toLowerCase().replace(" (bowel)", "")} cancer specialists`.replace("another type cancer", "cancer") : "cancer specialists";
  const buildItems: [string, string][] = buildModel
    ? [
        [`Matched ${buildModel.m.options.length} partner hospitals with ${dxSurgeons}`, buildModel.m.options.map((o) => o.hospital.city).join(" · ")],
        [`Estimated all-in costs in ${cur.code}`, `Expected totals from ${money(buildModel.lo)} to ${money(buildModel.hi)}`],
        [`Checked travel and entry from ${F.origin?.city ?? origin.city}`, buildModel.m.options.map((o) => `${o.hospital.city}: ${o.route.mode === "drive" ? "drive" : "flight"}${o.visa.needed ? ", visa" : ""}`).join(" · ") + " (sample rules)"],
        ["Scored every option by your priorities", buildModel.within.length ? `${buildModel.within.length} within your budget, led by ${buildModel.within.slice(0, 2).map((o) => o.hospital.city).join(" and ")}` : `Best fit: ${buildModel.m.options[0]?.hospital.city}`],
        ["Built your records checklist", `${buildModel.records} items, starting with scans and the biopsy report`],
        ["Introduced your coordinator", `${COORDINATOR.name} · Arabic and English · replies within 2 hours`],
      ]
    : [];
  const possessive = F.forWhom === "self" ? "your" : F.name ? `${F.name.split(" ")[0]}’s` : "the";

  /* ---------- question view ---------- */
  const qHelp = currentQ ? qText(currentQ, F)[1] : "";
  type Opt = { id: string; label: string; sub?: string; on: boolean; badge?: string; pick: () => void };
  let options: Opt[] = [];
  let needsContinue = false;
  let continueLabel = "Continue";
  let onContinue: () => void = () => {};
  let optional = false;
  const single = <T extends string>(list: { id: T; label: string; sub?: string }[], cur: T | null, key: keyof Answers): Opt[] =>
    list.map((o) => ({ id: o.id, label: o.label, sub: o.sub, on: cur === o.id, pick: () => answer(currentQ!, { [key]: o.id } as Answers) }));
  if (currentQ === "diagnosis") options = single(DIAGNOSES, F.dx, "dx");
  if (currentQ === "stage") options = single(STAGES, F.stage, "stage");
  if (currentQ === "timeline") options = single(TIMELINES, F.time, "time");
  if (currentQ === "budget") options = single(budgets, F.budget, "budget");
  if (currentQ === "insurance") {
    options = single(INSURANCE, F.pay, "pay");
    optional = true;
  }
  if (currentQ === "origin")
    options = ORIGINS.filter((o) => o.id !== "other").map((o) => ({
      id: o.id,
      label: o.label,
      sub: o.city,
      on: F.origin?.v === o.id,
      pick: () => answer("origin", { origin: o.id, originCity: o.city }),
    }));
  if (currentQ === "languages" || currentQ === "destinations") {
    const isD = currentQ === "destinations";
    const list: { id: string; label: string; sub?: string }[] = isD
      ? HOSPITALS.map((h) => {
          const o = F.origin ? ORIGIN_BY_ID[F.origin.v] : null;
          const same = o?.country === h.country;
          const visaFree = !!o && h.visa.free.includes(o.id);
          return { id: h.id, label: h.city, sub: o ? `${same ? "Drive" : "Flight"} · ${same ? "no visa" : visaFree ? "no visa needed" : "visa needed"} (sample)` : h.name };
        })
      : LANGUAGES;
    options = list.map((o) => {
      const on = multi.includes(o.id);
      return { ...o, on, pick: () => { setMulti(on ? multi.filter((x) => x !== o.id) : [...multi, o.id]); setErr(null); } };
    });
    if (isD) {
      const all = multi.length === HOSPITALS.length;
      options.push({ id: "all", label: "Open to anywhere", sub: "Compare all five", on: all, pick: () => setMulti(all ? [] : HOSPITALS.map((h) => h.id)) });
    }
    needsContinue = true;
    continueLabel = multi.length ? `Continue with ${multi.length}` : "Continue";
    onContinue = () => {
      if (!multi.length) {
        setErr(isD ? "Choose at least one place, or “Open to anywhere”." : "Choose at least one language.");
        return;
      }
      answer(currentQ, isD ? { dest: multi as HospitalId[] } : { langs: multi as LangId[] });
    };
  }
  if (currentQ === "priorities") {
    options = PRIORITIES.map((o) => {
      const at = rank.indexOf(o.id);
      return { id: o.id, label: o.label, sub: o.desc, on: at >= 0, badge: at >= 0 ? String(at + 1) : undefined, pick: () => setRank(at >= 0 ? rank.filter((x) => x !== o.id) : [...rank, o.id]) };
    });
    needsContinue = true;
    continueLabel = rank.length === 5 ? "Use this order" : rank.length ? "Continue (rest in default order)" : "Use default order";
    onContinue = () => answer("priorities", { prio: [...rank, ...DEFAULT_PRIORITIES.filter((p) => !rank.includes(p))] });
  }
  if (currentQ === "who") {
    needsContinue = true;
    onContinue = () => {
      const nm = (ans.name ?? F.name ?? "").trim();
      const who = ans.forWhom ?? F.forWhom ?? "family";
      if (!nm && who !== "self") {
        setErr("Add the patient’s name so I can set up the case.");
        return;
      }
      answer("who", { forWhom: who, name: nm || undefined });
    };
  }
  if (currentQ === "contact") {
    needsContinue = true;
    continueLabel = "Save and review my brief";
    onContinue = () => {
      const em = (ans.email ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setErr("Add an email like name@example.com so I can save the case.");
        return;
      }
      answer("contact", { email: em });
    };
  }
  const isChoice = currentQ !== "who" && currentQ !== "contact";

  /* ---------- brief ---------- */
  type Seg = { t: string; tok?: Qid; missing?: boolean };
  const S = (t: string): Seg => ({ t });
  const T = (t: string, tok: Qid, miss = !t): Seg => ({ t: miss ? "add this" : t, tok, missing: miss });
  const stageTxt = F.stage ? (F.stage === "unsure" ? "stage not yet known" : `stage ${F.stage}`) : "";
  const dxTxt = F.dx ? (F.dx === "other" ? "cancer (type to confirm)" : `${labelOf(DIAGNOSES, F.dx)!.split(" ")[0].toLowerCase()} cancer`) : "";
  const he = ["father", "dad", "husband", "son", "brother", "uncle", "grandfather"].includes(F.rel ?? "") ? "he" : ["mother", "mum", "mom", "wife", "daughter", "sister", "aunt", "grandmother"].includes(F.rel ?? "") ? "she" : "they";
  const poss = ["son", "husband", "brother", "nephew"].includes(F.mgrRel ?? "") ? "his" : F.mgrRel ? "her" : F.mgr ? "their" : "your";
  const langsTxt = F.langs?.length ? F.langs.map((l) => labelOf(LANGUAGES, l)).join(" and ") : "";
  const timeTxt = F.time ? labelOf(TIMELINES, F.time)!.toLowerCase() : "";
  const payTxt = F.pay ? INSURANCE_BRIEF[F.pay] : "";
  const destTxt = F.dest?.length ? (F.dest.length === HOSPITALS.length ? "open to anywhere" : `considering ${F.dest.map((d) => labelOf(HOSP_LABELS, d)).join(", ")}`) : "";
  const prioTxt = F.prio ? F.prio.slice(0, 3).map((p, i) => (i ? "then " : "") + labelOf(PRIORITIES, p)!.toLowerCase()).join(", ") : "";
  const brief: Seg[] =
    F.forWhom === "self"
      ? [S("I’m helping "), T("you", "who"), S(" plan care for "), T(stageTxt, "stage"), S(" "), T(dxTxt, "diagnosis"), S(". You live in "), T(F.origin?.label ?? "", "origin"), S(" and speak "), T(langsTxt, "languages"), S(". You’d like to start "), T(timeTxt, "timeline"), S(", with about "), T(budgetLabel(F.budget), "budget"), S(" for medical costs, "), T(payTxt.replace("themselves", "yourself"), "insurance"), S(". You’re "), T(destTxt, "destinations"), S(", and what matters most is "), T(prioTxt, "priorities"), S(".")]
      : [S("I’m helping "), T(F.mgr || "you", "who", false), S(` plan care for ${poss} `), T(`${F.rel ? F.rel + ", " : ""}${F.name ?? ""}${F.age ? ` (${F.age})` : ""}`, "who", !F.name), S(", who has "), T(stageTxt, "stage"), S(" "), T(dxTxt, "diagnosis"), S(". They live in "), T(F.origin?.label ?? "", "origin"), S(` and ${he} ${he === "they" ? "speak" : "speaks"} `), T(langsTxt, "languages"), S(". They’d like to start "), T(timeTxt, "timeline"), S(", with about "), T(budgetLabel(F.budget), "budget"), S(" for medical costs, "), T(payTxt, "insurance"), S(". They’re "), T(destTxt, "destinations"), S(", and what matters most is "), T(prioTxt, "priorities"), S(".")];
  const briefMissing = brief.some((b) => b.missing);

  const stepIdx = { story: 0, think: 0, ask: 1, brief: 2, build: 3 }[step];
  const h1: React.CSSProperties = { margin: 0, fontSize: "clamp(34px, 4vw, 54px)", lineHeight: 1.05, letterSpacing: "-0.03em", fontWeight: 800 };
  const typedTitle = (
    <>
      {ackText && (
        <p style={{ margin: "0 0 10px", fontSize: 18, color: "var(--mint-soft)", minHeight: "1.5em", maxWidth: "40em" }}>
          <span className="sr-only">{ackText}</span>
          <span aria-hidden="true">{typed.ackShown}</span>
        </p>
      )}
      <h1 style={{ ...h1, minHeight: "1.1em" }}>
        <span className="sr-only">{titleText}</span>
        <span aria-hidden="true">
          {typed.titleShown}
          {typed.typing && <span className="bv-caret">|</span>}
        </span>
      </h1>
    </>
  );

  return (
    <div className="flow">
      <FlowBackdrop />
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Brand />
          <PhaseList active={0} links={editMode} sub={["", " · questions", " · brief", " · case"][stepIdx]} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span key={saved} className={`hide-md${saved ? " bv-flash" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--muted)", padding: "4px 8px", borderRadius: 999 }}>
              <Check size={15} style={{ color: "var(--mint)" }} />
              {saved ? "Saved" : "Autosave on"}
            </span>
            <CurrencyMenu />
            <Link href={editMode ? resumePath(state) : "/"} style={{ color: "#dce6e2", textDecoration: "none", fontWeight: 600, padding: "0 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              {editMode ? "Back to my case" : "Save and exit"}
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap flow-main">
        <section aria-label="Assistant" className="flow-section">
          <AssistantIdentity status={status} busy={thinking || listening} mode={mode} />

          {step === "story" && (
            <div>
              {typedTitle}
              <p className="bv-in bv-d2" style={{ margin: "14px 0 0", fontSize: 19, color: "var(--muted)", maxWidth: "36em" }}>
                Write it the way you’d tell a friend: who it’s for, what the doctor said, where you live. I’ll pick out the details and only ask about what’s missing.
              </p>
              <div
                className="bv-in bv-d3"
                style={{
                  marginTop: 26,
                  borderRadius: 28,
                  background: "rgba(247,244,236,0.06)",
                  transition: "border-color .3s ease, box-shadow .3s ease",
                  border: `1.5px solid ${listening ? "var(--mint)" : "rgba(247,244,236,0.16)"}`,
                  boxShadow: listening ? "0 0 0 6px rgba(111,208,195,0.12), 0 30px 60px -40px rgba(111,208,195,0.6)" : "none",
                }}
              >
                <label htmlFor="bv-story" className="sr-only">
                  Describe the situation in your own words
                </label>
                <textarea
                  id="bv-story"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setAuto(null);
                    setStoryErr(false);
                  }}
                  placeholder={PLACEHOLDERS[ph]}
                  rows={6}
                  style={{ width: "100%", display: "block", resize: "none", border: 0, background: "transparent", color: "var(--ivory)", font: "inherit", fontSize: 21, lineHeight: 1.5, padding: "22px 24px 8px", minHeight: 196, outline: "none" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px 12px 16px", flexWrap: "wrap" }}>
                  {voice ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 10px", borderRadius: 999, background: "rgba(243,174,120,0.16)", color: "var(--sand-soft)", fontSize: 14, fontWeight: 600 }}>
                      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 20 }}>
                        {[0, 0.15, 0.3, 0.45, 0.6].map((d) => (
                          <span key={d} className="bv-bar" style={{ width: 3, height: 18, borderRadius: 3, background: "var(--sand)", animationDelay: `${d}s` }} />
                        ))}
                      </span>
                      Listening (sample voice)
                    </span>
                  ) : (
                    <button type="button" className="pill-btn" onClick={() => { setVoice(true); setText(""); setAuto(SAMPLE_STORY); setStoryErr(false); }} style={{ borderColor: "rgba(247,244,236,0.22)" }}>
                      <Mic size={17} />
                      Speak instead
                    </button>
                  )}
                  {storyFound > 0 && (
                    <span key={storyFound} className="bv-swap" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(111,208,195,0.14)", color: "var(--mint-soft)", fontWeight: 600, fontSize: 14 }}>
                      <Sparkle size={14} />
                      {storyFound} {storyFound === 1 ? "detail" : "details"} found
                    </span>
                  )}
                </div>
              </div>
              <div className="bv-in bv-d4" style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--muted)", marginRight: 4 }}>Or start with</span>
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="bv-tile" onClick={() => { setText((t) => (t ? t.trim() + " " : "") + s + ". "); setStoryErr(false); }} style={{ minHeight: 40, padding: "6px 14px", borderRadius: 999, border: "1.5px solid rgba(247,244,236,0.16)", background: "rgba(247,244,236,0.05)", color: "var(--ivory)", fontSize: 15, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="bv-in bv-d4 actions" style={{ marginTop: 32, gap: 16 }}>
                <button type="button" className="btn btn-primary btn-lg bv-btn" onClick={continueStory} aria-disabled={text.trim().length < 12} style={{ opacity: text.trim().length < 12 ? 0.55 : 1 }}>
                  {storyFound > 0 ? `Continue · I found ${storyFound} details` : "Continue"}
                  <Arrow size={20} />
                </button>
                <button type="button" className="link-btn" onClick={() => { setText(""); setAuto(SAMPLE_STORY); setStoryErr(false); }}>
                  Use a sample story
                </button>
                {storyErr && (
                  <span role="alert" style={{ color: "var(--sand-soft)", fontSize: 15 }}>
                    Add a sentence or two first, or use the sample story.
                  </span>
                )}
              </div>
            </div>
          )}

          {step === "think" && (
            <div>
              <h1 className="bv-in" style={h1}>Reading what you shared</h1>
              <ul style={{ margin: "28px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14, fontSize: 19 }}>
                {[`Picked out ${Math.max(storyFound, 1)} details from your story`, "Matched them to the case information specialists need", ai ? `Found ${queue.length} things left to ask` : "Working out what’s left to ask"].map((t, i) => (
                  <li key={t} className="bv-in" style={{ display: "flex", alignItems: "center", gap: 12, animationDelay: `${0.2 + i * 0.75}s` }}>
                    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(111,208,195,0.16)", color: "var(--mint)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Check size={15} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div aria-hidden="true" style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
                {["92%", "74%", "83%"].map((w) => (
                  <span key={w} className="bv-shimmer" style={{ height: 14, borderRadius: 8, width: w }} />
                ))}
              </div>
            </div>
          )}

          {step === "ask" && currentQ && (
            <div>
              {typedTitle}
              {typed.done && (
                <div>
                  <p className="bv-in" style={{ margin: "12px 0 0", fontSize: 18, color: "var(--muted)", maxWidth: "38em" }}>{qHelp}</p>
                  {isChoice && (
                    <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                      {options.map((o, i) => (
                        <button key={o.id} type="button" className={`tile bv-tile bv-in${o.on ? " is-on" : ""}`} onClick={o.pick} aria-pressed={o.on} style={{ minHeight: 64, animationDelay: `${0.04 * i}s` }}>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%" }}>
                            <span style={{ fontSize: 17, fontWeight: 700 }}>{o.label}</span>
                            {o.on && <span className="badge bv-pop">{o.badge ?? <Check size={14} />}</span>}
                          </span>
                          {o.sub && <span className="sub">{o.sub}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQ === "who" && (
                    <div className="bv-in" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {(["family", "self"] as const).map((w) => {
                          const on = (ans.forWhom ?? F.forWhom ?? "family") === w;
                          return (
                            <button key={w} type="button" className="bv-tile" aria-pressed={on} onClick={() => setAns({ ...ans, forWhom: w })} style={{ minHeight: 48, padding: "0 18px", borderRadius: 999, fontWeight: 600, cursor: "pointer", background: on ? "var(--ivory)" : "transparent", color: on ? "var(--navy)" : "var(--ivory)", border: `1.5px solid ${on ? "var(--ivory)" : "rgba(247,244,236,0.22)"}` }}>
                              {w === "family" ? "For a family member" : "For myself"}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <label className="label" style={{ flex: "2 1 260px" }}>
                          {(ans.forWhom ?? F.forWhom) === "self" ? "Your full name" : "Patient’s full name"}
                          <input className="field" type="text" value={ans.name ?? F.name ?? ""} onChange={(e) => { setAns({ ...ans, name: e.target.value }); setErr(null); }} placeholder="First and last name" autoComplete="off" />
                        </label>
                        <label className="label" style={{ flex: "1 1 120px" }}>
                          Age
                          <input className="field" type="number" inputMode="numeric" value={ans.age ?? F.age ?? ""} onChange={(e) => setAns({ ...ans, age: e.target.value })} placeholder="e.g. 68" />
                        </label>
                      </div>
                    </div>
                  )}
                  {currentQ === "contact" && (
                    <div className="bv-in" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
                      <label className="label">
                        Your email
                        <input className="field" type="email" inputMode="email" autoComplete="email" value={ans.email ?? ""} onChange={(e) => { setAns({ ...ans, email: e.target.value }); setErr(null); }} placeholder="name@example.com" style={{ minHeight: 60, fontSize: 21 }} />
                      </label>
                      <label className="label">
                        Phone or WhatsApp (optional)
                        <input className="field" type="tel" inputMode="tel" autoComplete="tel" value={ans.phone ?? ""} onChange={(e) => setAns({ ...ans, phone: e.target.value })} placeholder="+962 7 1234 5678" />
                      </label>
                      <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, color: "var(--muted)" }}>
                        <Lock size={18} style={{ color: "var(--mint)", flex: "none", marginTop: 2 }} />
                        Only you, the people you invite and your coordinator can see this case. Nothing goes to a hospital without your say.
                      </p>
                    </div>
                  )}
                  {err && (
                    <p role="alert" className="bv-swap" style={{ margin: "16px 0 0", color: "var(--sand-soft)", fontSize: 16 }}>
                      {err}
                    </p>
                  )}
                  {toast && (
                    <p key={toast.n} role="status" className="toast bv-swap" style={{ margin: "20px 0 0", fontSize: 16 }}>
                      <Check size={16} style={{ color: "var(--mint)" }} />
                      {toast.text}
                    </p>
                  )}
                  <div className="bv-in bv-d2 actions">
                    <button type="button" className="btn btn-outline" onClick={back}>Back</button>
                    {needsContinue && (
                      <button type="button" className="btn btn-primary bv-btn" onClick={onContinue}>
                        {continueLabel}
                        <Arrow size={18} />
                      </button>
                    )}
                    {optional && (
                      <button type="button" className="link-btn" onClick={() => answer("insurance", { pay: "unsure" })}>
                        Skip for now
                      </button>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--muted)" }}>{editing ? "Editing your brief" : `Question ${qi + 1} of ${queue.length}`}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "brief" && (
            <div>
              {typedTitle}
              <div className="bv-in bv-d2" style={{ marginTop: 26, padding: "30px clamp(20px, 3vw, 32px)", borderRadius: 28, background: "rgba(247,244,236,0.06)", border: "1px solid rgba(247,244,236,0.14)" }}>
                <p style={{ margin: 0, fontSize: "clamp(19px, 2vw, 23px)", lineHeight: 1.75, letterSpacing: "-0.005em" }}>
                  {brief.map((b, i) =>
                    b.tok ? (
                      <button
                        key={i}
                        type="button"
                        className="bv-tok"
                        onClick={() => editFromBrief(b.tok!)}
                        aria-label={`Change: ${b.missing ? b.tok : b.t}`}
                        style={{ display: "inline", fontWeight: 700, color: b.missing ? "var(--sand-soft)" : "var(--ivory)", background: b.missing ? "rgba(243,174,120,0.16)" : "rgba(111,208,195,0.16)", border: 0, borderBottom: `2px solid ${b.missing ? "var(--sand)" : "var(--mint)"}`, borderRadius: "8px 8px 2px 2px", padding: "1px 6px", margin: "0 1px", cursor: "pointer", lineHeight: "inherit", fontSize: "inherit" }}
                      >
                        {b.t}
                      </button>
                    ) : (
                      <span key={i}>{b.t}</span>
                    ),
                  )}
                </p>
                <p style={{ margin: "22px 0 0", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, color: "var(--muted)" }}>
                  <Sparkle size={18} style={{ color: "var(--mint)", flex: "none", marginTop: 2 }} />
                  This is a summary of what you told me, not a diagnosis. Specialists confirm medical details from the records.
                </p>
              </div>
              {!editMode && (
                <ol className="bv-in bv-d3" style={{ margin: "26px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  {[["I match partner hospitals", `and estimate all-in costs in ${cur.code}.`], ["You add records", "I sort and translate them for you."], [`${COORDINATOR.name.split(" ")[0]}, your coordinator`, "checks everything with you."]].map(([a, b], i) => (
                    <li key={a} style={{ padding: 18, borderRadius: 20, background: "rgba(247,244,236,0.04)", border: "1px solid rgba(247,244,236,0.1)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sand)", letterSpacing: "0.08em" }}>NEXT · {i + 1}</div>
                      <div style={{ marginTop: 4, fontWeight: 700 }}>{a}</div>
                      <div style={{ fontSize: 15, color: "var(--muted)" }}>{b}</div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="bv-in bv-d4 actions" style={{ gap: 16 }}>
                <button type="button" className="btn btn-primary btn-lg bv-btn" onClick={createCase} aria-disabled={briefMissing && !editMode} style={{ opacity: briefMissing ? 0.7 : 1 }}>
                  {editMode ? "Save changes" : "Create my case"}
                  <Arrow size={20} />
                </button>
                <span style={{ fontSize: 15, color: "var(--muted)" }}>
                  {briefMissing ? "Tap “add this” to fill the gaps, or continue and add them later." : F.email ? `Saving to ${F.email}` : "Saved on this device (prototype)"}
                </span>
              </div>
            </div>
          )}

          {step === "build" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
              <div className="bv-in" style={{ flex: "1 1 380px", minWidth: 0, maxWidth: 560 }}>
                <Globe routes={buildRoutes} active={gAct % Math.max(1, buildRoutes.length)} />
              </div>
              <div style={{ flex: "1 1 400px", minWidth: 0 }}>
                <h1 className="bv-in" style={{ ...h1, fontSize: "clamp(32px, 3.6vw, 48px)" }}>Building {possessive} case</h1>
                <p className="bv-in bv-d1" style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 18 }}>Working through it now. Everything here uses sample providers and prices.</p>
                <div aria-hidden="true" style={{ marginTop: 22, height: 6, borderRadius: 999, background: "rgba(247,244,236,0.12)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #197C78, #6FD0C3)", transition: "width 1s ease", width: `${Math.round((Math.min(6, build) / 6) * 100)}%` }} />
                </div>
                <ol aria-live="polite" style={{ margin: "22px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {buildItems.map(([title, result], i) => {
                    const done = i < build;
                    const running = i === build && build < 6;
                    return (
                      <li key={title} className="check-row" style={{ alignItems: "flex-start", opacity: i <= build ? 1 : 0.35, background: i <= build ? "rgba(247,244,236,0.05)" : "transparent" }}>
                        <span aria-hidden="true" className="check-icon">
                          {done && <span className="check-done bv-pop"><Check size={15} style={{ color: "#fff" }} /></span>}
                          {running && <span className="spinner bv-spinner" />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{title}</div>
                          {done && <div className="bv-swap" style={{ fontSize: 15, color: "var(--muted)" }}>{result}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {build >= 6 && (
                  <div className="bv-in card-l" style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                    <span className="avatar" aria-hidden="true" style={{ position: "relative", width: 52, height: 52, background: "var(--sand)" }}>
                      {COORDINATOR.initials}
                      <span style={{ position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 999, background: "var(--teal)", border: "2px solid var(--ivory)" }} />
                    </span>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 19 }}>{cap(possessive)} case is ready</div>
                      <div style={{ fontSize: 15, color: "var(--ink-soft)" }}>{COORDINATOR.name} will review it with you. She speaks Arabic and English.</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link href="/case/records" className="btn btn-primary bv-btn">
                        Add records
                        <Arrow size={18} />
                      </Link>
                      <Link href="/case/options" className="btn btn-outline-ink">
                        Preview options
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {step !== "build" && (
          <aside aria-label="What the assistant has understood" className="panel bv-in bv-d2">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkle size={18} style={{ color: "var(--mint)" }} />
              <h2>What I’ve understood</h2>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--sand)" }}>
                <span className="bv-halo" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--sand)", display: "inline-block" }} />
                LIVE
              </span>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--muted)" }}>
              <span>{nFound} of {rows.length} details</span>
              <span>{pct}%</span>
            </div>
            <div aria-hidden="true" style={{ marginTop: 8, height: 6, borderRadius: 999, background: "rgba(247,244,236,0.1)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #197C78, #6FD0C3)", transition: "width .6s cubic-bezier(.2,.7,.2,1)", width: `${pct}%` }} />
            </div>
            <dl style={{ margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 2 }}>
              {rows.map((r) => (
                <div key={`${r.k}${ver.current[r.k] ?? 0}`} className={r.v && ver.current[r.k] ? "bv-flash" : ""} style={{ display: "flex", gap: 12, padding: "9px 10px", borderRadius: 12, alignItems: "baseline" }}>
                  <dt style={{ width: 112, flex: "none", fontSize: 14, color: "var(--muted)" }}>{r.label}</dt>
                  <dd style={{ margin: 0, minWidth: 0, flex: 1 }}>
                    {r.v ? (
                      <>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{r.v}</span>
                        {r.q && <span style={{ display: "block", fontSize: 12, color: "var(--muted-2)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>from “{r.q}”</span>}
                      </>
                    ) : (
                      <span className="bv-shimmer" style={{ height: 10, width: "70%", borderRadius: 6, marginTop: 6 }} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="panel-foot" style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Lock size={16} style={{ color: "var(--mint)", flex: "none", marginTop: 1 }} />
              <span>
                Saved privately as you go. AI suggestions are drafts; you and your coordinator decide.
                {ai && <> Read by {ai.source === "claude" ? "Claude" : "the on-device demo assistant"}.</>}
              </span>
            </p>
          </aside>
        )}
      </main>
    </div>
  );
}
