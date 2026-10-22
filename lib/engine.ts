import {
  BUDGETS,
  DX_COST,
  DX_INFO,
  DX_VOLUME,
  HOSPITALS,
  LANG_LABEL,
  ORIGIN_BY_ID,
  STAGE_COST,
  STAGE_STAY,
  type DestId,
  type DxId,
  type Hospital,
  type Intake,
  type LangId,
  type OriginInfo,
  type PriorityId,
} from "./data";
import { addDays, clamp01, fmtHours, round10, round100, startOfDay, usd } from "./format";

/* =====================================================================
   Options: cost, route, visa, language fit and priority scoring
   ===================================================================== */

export type CostView = "low" | "expected" | "high";
export const COST_VIEWS: { id: CostView; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "expected", label: "Expected" },
  { id: "high", label: "High" },
];

export type LineId = "treatment" | "diagnostics" | "accommodation" | "travel" | "support" | "visa";

export interface CostLine {
  id: LineId;
  label: string;
  low: number;
  expected: number;
  high: number;
}

export interface Route {
  mode: "drive" | "flight";
  km: number;
  hours: number;
  /** Main leg: flights for two travellers, or driver and fuel. */
  main: number;
  /** Local transport during the stay. */
  local: number;
  label: string;
}

export interface VisaInfo {
  needed: boolean;
  sameCountry: boolean;
  kind: string;
  fee: number;
  days: number;
}

export interface OptionResult {
  hospital: Hospital;
  route: Route;
  visa: VisaInfo;
  specialist: { name: string; role: string; years: number; cases: number };
  lang: { direct: LangId[]; viaInterpreter: LangId[]; gap: boolean; text: string; score: number };
  lines: CostLine[];
  totals: Record<CostView, number>;
  apptDays: number;
  stayDays: number;
  scores: Record<PriorityId, number>;
  match: number;
  budget: { status: "within" | "above" | "unknown"; overBy: number };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildRoute(origin: OriginInfo, h: Hospital, sameCountry: boolean): Route {
  if (origin.lat === null || origin.lon === null) {
    const km = 4500;
    const hours = km / 800 + 0.75;
    return {
      mode: "flight",
      km,
      hours,
      main: round10(2 * (140 + 0.28 * km)),
      local: 300,
      label: `about ${fmtHours(hours)} flight from your home city`,
    };
  }
  const straight = haversineKm(origin.lat, origin.lon, h.lat, h.lon);
  if (sameCountry) {
    const road = straight * 1.25;
    const hours = road / origin.driveKmh;
    return {
      mode: "drive",
      km: road,
      hours,
      main: Math.max(80, round10(road * 2 * 0.45)),
      local: 120,
      label: `${fmtHours(hours)} drive from ${origin.city}`,
    };
  }
  const hours = straight / 800 + 0.75;
  return {
    mode: "flight",
    km: straight,
    hours,
    main: round10(2 * (140 + 0.28 * straight)),
    local: 300,
    label: `${fmtHours(hours)} flight from ${origin.label}`,
  };
}

function evaluate(intake: Intake, origin: OriginInfo, h: Hospital): OptionResult {
  const dx: DxId = intake.diagnosis ?? "other";
  const stage = intake.stage ?? "unsure";
  const patientLangs: LangId[] = intake.languages.length ? intake.languages : ["english"];

  const sameCountry = origin.country === h.country;
  const visaNeeded = !sameCountry && !h.visa.free.includes(origin.id);
  const visa: VisaInfo = { needed: visaNeeded, sameCountry, kind: h.visa.kind, fee: h.visa.fee, days: h.visa.days };

  const route = buildRoute(origin, h, sameCountry);

  const direct = patientLangs.filter((l) => h.languages.includes(l));
  const viaInterpreter = patientLangs.filter((l) => !direct.includes(l) && h.interpreter.includes(l));
  const gap = direct.length === 0;
  const names = (ls: LangId[]) => ls.map((l) => LANG_LABEL[l]).join(" and ");
  const langText = direct.length
    ? `${names(direct)} spoken directly`
    : viaInterpreter.length
      ? `${names(viaInterpreter)} interpreter provided`
      : "Interpreter arranged by us";
  const langScore = direct.length ? 1 : viaInterpreter.length ? 0.55 : 0.2;

  const medMul = STAGE_COST[stage] * DX_COST[dx];
  const stayDays = Math.max(7, Math.round(h.baseStay * STAGE_STAY[stage]));
  const base: { id: LineId; label: string; amount: number }[] = [
    { id: "treatment", label: "Treatment and hospital stay", amount: round100(h.baseTreatment * medMul) },
    { id: "diagnostics", label: "Scans, tests and medicines", amount: round100(h.baseDiagnostics * medMul) },
    { id: "accommodation", label: "Accommodation for the estimated stay", amount: round10(h.nightly * stayDays) },
    { id: "travel", label: "Flights and local transport", amount: round10(route.main + route.local) },
    { id: "support", label: "Caregiver, translator and support", amount: round10(h.supportBase * (gap ? 1 : 0.5)) },
  ];
  if (visaNeeded) base.push({ id: "visa", label: "Visa and entry", amount: h.visa.fee });

  // A "not sure" stage widens the range because the treatment plan is less certain.
  const widen = stage === "unsure" ? 1 : 0;
  const lowMul = h.low - 0.05 * widen;
  const highMul = h.high + 0.07 * widen;
  const lines: CostLine[] = base.map((b) => ({
    id: b.id,
    label: b.label,
    low: round10(b.amount * lowMul),
    expected: b.amount,
    high: round10(b.amount * highMul),
  }));
  const totals: Record<CostView, number> = {
    low: lines.reduce((s, l) => s + l.low, 0),
    expected: lines.reduce((s, l) => s + l.expected, 0),
    high: lines.reduce((s, l) => s + l.high, 0),
  };

  const apptDays = h.apptDays + (visaNeeded ? h.visa.days : 0);
  const info = DX_INFO[dx];
  const specialist = {
    name: h.specialist.name,
    role: h.id === "berlin" ? info.head : info.surgeon,
    years: h.specialist.years,
    cases: Math.max(10, Math.round((h.specialist.cases * DX_VOLUME[dx]) / 10) * 10),
  };

  const budgetMax = BUDGETS.find((b) => b.id === intake.budget)?.max ?? null;
  const budget: OptionResult["budget"] =
    budgetMax === null
      ? { status: "unknown", overBy: 0 }
      : totals.expected <= budgetMax
        ? { status: "within", overBy: 0 }
        : { status: "above", overBy: totals.expected - budgetMax };

  const scores: Record<PriorityId, number> = {
    experience: clamp01(h.specialist.cases / 900) * 0.6 + clamp01(h.specialist.years / 25) * 0.4,
    language: langScore * 0.6 + h.culture * 0.4,
    cost: clamp01(1 - (totals.expected - 12000) / 60000) * (budget.status === "above" ? 0.7 : 1),
    family: clamp01((route.mode === "drive" ? 1 - route.hours / 10 : 1 - (route.hours + 1) / 9) - (visaNeeded ? 0.1 : 0)),
    speed: clamp01(1 - (apptDays - 5) / 30),
  };

  const weights = priorityWeights(intake.priorities);
  const match = Math.round(100 * (Object.keys(scores) as PriorityId[]).reduce((s, k) => s + scores[k] * (weights[k] ?? 0), 0));

  return {
    hospital: h,
    route,
    visa,
    specialist,
    lang: { direct, viaInterpreter, gap, text: langText, score: langScore },
    lines,
    totals,
    apptDays,
    stayDays,
    scores,
    match,
    budget,
  };
}

/** Rank 1 gets the most weight: 5/15, 4/15, 3/15, 2/15, 1/15. */
export function priorityWeights(order: PriorityId[]): Record<PriorityId, number> {
  const n = order.length;
  const total = (n * (n + 1)) / 2;
  const w = {} as Record<PriorityId, number>;
  order.forEach((id, i) => {
    w[id] = (n - i) / total;
  });
  return w;
}

export function evaluateAll(intake: Intake): OptionResult[] {
  const origin = ORIGIN_BY_ID[intake.origin ?? "other"];
  return HOSPITALS.map((h) => evaluate(intake, origin, h));
}

export function matchedOptions(intake: Intake): { options: OptionResult[]; widened: boolean } {
  const all = evaluateAll(intake);
  const origin = ORIGIN_BY_ID[intake.origin ?? "other"];
  const dests = new Set<DestId>(intake.destinations);
  let picked = all.filter(
    (o) => dests.has(o.hospital.region) || (dests.has("home") && origin.nearHome.includes(o.hospital.id)),
  );
  let widened = false;
  if (picked.length < 2) {
    picked = all;
    widened = true;
  }
  return { options: [...picked].sort((a, b) => b.match - a.match), widened };
}

export function viewLines(o: OptionResult, view: CostView) {
  return o.lines.map((l) => ({ id: l.id, label: l.label, amount: l[view] }));
}

export function fmtAppt(o: OptionResult): string {
  if (o.apptDays < 14) return `${o.apptDays} days`;
  const weeks = o.apptDays / 7;
  const lo = Math.floor(weeks);
  const hi = Math.ceil(weeks) === lo ? lo + 1 : Math.ceil(weeks);
  return `${lo}–${hi} weeks${o.visa.needed ? ", including visa" : ""}`;
}

export function routeLabel(o: OptionResult): string {
  const visa = o.visa.sameCountry ? "no visa" : o.visa.needed ? "visa needed" : "no visa needed";
  return `${o.route.label} · ${visa}`;
}

/* =====================================================================
   Plan: tasks, who handles them, and the price impact of taking part on
   ===================================================================== */

export type Owner = "bv" | "self";
export type TaskId = "consult" | "records" | "visa" | "payment" | "travel" | "stay" | "transfers" | "support" | "followup";
export type Phase = "before" | "during" | "after";
export type TaskStatus = "na" | "not_started" | "in_progress" | "done";

export const PHASES: { id: Phase; label: string }[] = [
  { id: "before", label: "Before travel" },
  { id: "during", label: "During your stay" },
  { id: "after", label: "After treatment" },
];

export interface PlanTask {
  id: TaskId;
  phase: Phase;
  title: string;
  desc: string;
  due: Date;
  na: boolean;
  naText?: string;
  /** Cost inside the estimate when Bon Voyage handles the task. */
  bv: number;
  /** Total cost for the same task when you handle it. */
  self: { low: number; exp: number; high: number };
  /** Hours of your own time if you take it on. */
  hours: number;
  whyBv: string;
  whySelf: string;
  heads?: string;
  defaultOwner: Owner;
}

export interface Plan {
  tasks: PlanTask[];
  base: Date;
  travel: Date;
  first: Date;
  treatment: Date;
  home: Date;
}

export function buildPlan(intake: Intake, o: OptionResult, chosenAt: string): Plan {
  const base = startOfDay(new Date(chosenAt));
  const A = Math.max(o.apptDays, 6);
  const first = addDays(base, A);
  const travel = addDays(first, -1);
  const home = addDays(first, o.stayDays);
  const treatment = addDays(first, 6);
  const intl = o.route.mode === "flight";
  const gap = o.lang.gap;
  const drive = o.route.mode === "drive";
  const line = (id: LineId) => o.lines.find((l) => l.id === id)?.expected ?? 0;
  const fmul = intl ? 1 : 0.35;

  const stayBv = line("accommodation");
  const supportBv = line("support");
  const treatBv = line("treatment");
  const physical = !!intake.diagnosis && intake.diagnosis !== "other";

  const tasks: PlanTask[] = [
    {
      id: "consult",
      phase: "before",
      title: `Video consultation with ${o.specialist.name}`,
      desc: "30 minutes online, interpreter if needed. Ask your questions before committing.",
      due: addDays(base, Math.max(3, Math.ceil(A * 0.45))),
      na: false,
      bv: 0,
      self: { low: 0, exp: gap ? 60 : 0, high: gap ? 120 : 0 },
      hours: 1,
      whyBv: gap
        ? "An interpreter and a coordinator join the call, booked around your family's schedule."
        : "A coordinator joins the call and books a time that suits your family.",
      whySelf: gap
        ? "Booking direct means paying the hospital's interpreter fee, and you chase the time slot yourself."
        : "You book directly with the hospital. No extra cost, but no coordinator on the call.",
      defaultOwner: "bv",
    },
    {
      id: "records",
      phase: "before",
      title: "Send records to the hospital",
      desc: `Complete translated file sent to ${o.specialist.name}'s team${physical ? "; slides sent by medical courier" : ""}.`,
      due: addDays(base, 2),
      na: false,
      bv: 0,
      self: { low: round10(30 * fmul), exp: round10(90 * fmul), high: round10(480 * fmul) },
      hours: 4,
      whyBv: "We send one complete, translated file and arrange the courier for physical samples.",
      whySelf:
        "Retail courier rates, and if files arrive incomplete or untranslated the hospital may repeat tests. That repeat is the high case.",
      defaultOwner: "bv",
    },
    o.visa.needed
      ? {
          id: "visa",
          phase: "before",
          title: "Visa and entry",
          desc: `${o.visa.kind}, about ${o.visa.days} days. Sample rule — your coordinator checks it against your passport.`,
          due: addDays(base, 1),
          na: false,
          bv: line("visa"),
          self: { low: line("visa"), exp: line("visa") + 50, high: line("visa") + 200 },
          hours: 5,
          whyBv: "We request the hospital invitation letter and check your documents before you apply.",
          whySelf:
            "You gather the invitation letter and forms yourself. Agent fees or a re-application are the main extra costs.",
          heads: "A rejected application restarts the clock and delays your first appointment.",
          defaultOwner: "bv",
        }
      : {
          id: "visa",
          phase: "before",
          title: "Visa and entry",
          desc: "",
          due: addDays(base, 1),
          na: true,
          naText: o.visa.sameCountry ? "Not needed — home country." : "Not needed for your passport (sample rule).",
          bv: 0,
          self: { low: 0, exp: 0, high: 0 },
          hours: 0,
          whyBv: "",
          whySelf: "",
          defaultOwner: "bv",
        },
    {
      id: "payment",
      phase: "before",
      title: "Pay the hospital deposit and invoices",
      desc: "Paid directly to the hospital. Bon Voyage never holds the money.",
      due: addDays(base, Math.max(2, A - 4)),
      na: false,
      bv: 0,
      self: {
        low: round10(treatBv * 0.006 * (intl ? 1 : 0.4) + 25 * (intl ? 1 : 0.3)),
        exp: round10(treatBv * 0.018 * (intl ? 1 : 0.4) + 45 * (intl ? 1 : 0.3)),
        high: round10(treatBv * 0.035 * (intl ? 1 : 0.4) + 70 * (intl ? 1 : 0.3)),
      },
      hours: 2,
      whyBv: "We pay at the interbank rate with no markup and send you every receipt.",
      whySelf:
        "Your bank adds currency conversion and wire fees. On a large invoice a few percent adds up quickly.",
      defaultOwner: "bv",
    },
    {
      id: "travel",
      phase: "before",
      title: drive ? `Drive to ${o.hospital.city}` : `Flights to ${o.hospital.city}`,
      desc: drive ? `${o.route.label}.` : `${o.route.label}. Two travellers, flexible fares.`,
      due: drive ? travel : addDays(base, Math.max(1, A - 6)),
      na: false,
      bv: o.route.main,
      self: drive
        ? { low: round10(o.route.main * 0.4), exp: round10(o.route.main * 0.55), high: round10(o.route.main * 0.9) }
        : { low: round10(o.route.main * 0.8), exp: round10(o.route.main * 1.1), high: round10(o.route.main * 1.45) },
      hours: drive ? 1 : 3,
      whyBv: drive
        ? "We can arrange a driver, with an accessible van if mobility is limited."
        : "We hold flexible fares and rebook if the hospital moves a date.",
      whySelf: drive
        ? "Your own car costs mostly fuel, which is usually the cheapest way."
        : "You may find cheaper seats by shopping around, but date changes become your problem.",
      heads: drive ? undefined : "Hospital dates can move; non-refundable fares then cost more to change.",
      defaultOwner: drive ? "self" : "bv",
    },
    {
      id: "stay",
      phase: "before",
      title: "Accommodation near the hospital",
      desc: `About ${o.stayDays} nights. Close to ${o.hospital.name}.`,
      due: addDays(base, Math.max(1, A - 5)),
      na: false,
      bv: stayBv,
      self: { low: round10(stayBv * 0.45), exp: round10(stayBv * 1.1), high: round10(stayBv * 1.5) },
      hours: 3,
      whyBv: "Partner-hotel rate near the hospital, with a shuttle to appointments.",
      whySelf:
        "Staying with relatives or renting a flat can cost far less. A hotel booked at walk-in rates costs more than our partner rate.",
      defaultOwner: "bv",
    },
    {
      id: "transfers",
      phase: "during",
      title: drive ? `Getting around ${o.hospital.city}` : "Airport pickup and local transport",
      desc: drive ? "Trips between your stay and the hospital." : "Pre-booked, accessible vehicles for arrival and hospital visits.",
      due: travel,
      na: false,
      bv: o.route.local,
      self: { low: round10(o.route.local * 0.7), exp: round10(o.route.local * 1.2), high: round10(o.route.local * 1.8) },
      hours: 1,
      whyBv: "Pre-booked vehicles that are accessible and waiting when you land.",
      whySelf:
        "Taxis are fine for short trips, but the cost adds up over a long stay and vehicles may not be accessible.",
      defaultOwner: drive ? "self" : "bv",
    },
    {
      id: "support",
      phase: "during",
      title: gap ? "Interpreter and companion support" : "Companion support",
      desc: gap
        ? "A medical interpreter and a coordinator on call during appointments and paperwork."
        : "Someone to help with appointments, paperwork and daily needs.",
      due: travel,
      na: false,
      bv: supportBv,
      self: { low: round10(supportBv * 0.25), exp: round10(supportBv * 0.7), high: round10(supportBv * 1.5) },
      hours: 10,
      whyBv: gap
        ? "A trained medical interpreter and a coordinator on call for the whole stay."
        : "A coordinator on call for the whole stay, so family can rest.",
      whySelf: gap
        ? "A relative can fill the role for much less, but family members are not trained medical interpreters for consent discussions."
        : "A relative can fill the role for less, but you carry every appointment and form yourselves.",
      heads: gap ? "Medical interpreting needs precision. Ask the hospital before relying on family." : undefined,
      defaultOwner: "bv",
    },
    {
      id: "followup",
      phase: "after",
      title: "Hand over to your local doctor",
      desc: "Discharge summary, medicines and follow-up dates sent to your doctor at home.",
      due: addDays(home, 3),
      na: false,
      bv: 0,
      self: { low: 0, exp: round10(40 * fmul + 20), high: round10(120 * fmul + 20) },
      hours: 3,
      whyBv: "We translate the discharge summary and send it to your doctor with a plain-language note.",
      whySelf: "Translation of the discharge summary and courier at retail rates.",
      defaultOwner: "bv",
    },
  ];

  return { tasks, base, travel, first, treatment, home };
}

export function ownerOf(task: PlanTask, owners: Record<string, Owner>): Owner {
  return owners[task.id] ?? task.defaultOwner;
}

export function taskDelta(t: PlanTask) {
  return { low: t.self.low - t.bv, exp: t.self.exp - t.bv, high: t.self.high - t.bv };
}

export interface ImpactItem {
  task: PlanTask;
  low: number;
  exp: number;
  high: number;
}

export interface Impact {
  baseLow: number;
  baseExp: number;
  baseHigh: number;
  low: number;
  exp: number;
  high: number;
  delta: { low: number; exp: number; high: number };
  hours: number;
  selfCount: number;
  bvCount: number;
  items: ImpactItem[];
}

/** The estimate if you handle some tasks, compared with Bon Voyage handling everything. */
export function planImpact(o: OptionResult, plan: Plan, owners: Record<string, Owner>): Impact {
  const items: ImpactItem[] = [];
  let hours = 0;
  let bvCount = 0;
  for (const t of plan.tasks) {
    if (t.na) continue;
    if (ownerOf(t, owners) === "self") {
      items.push({ task: t, ...taskDelta(t) });
      hours += t.hours;
    } else bvCount += 1;
  }
  const sum = (k: "low" | "exp" | "high") => items.reduce((s, i) => s + i[k], 0);
  const delta = { low: sum("low"), exp: sum("exp"), high: sum("high") };
  return {
    baseLow: o.totals.low,
    baseExp: o.totals.expected,
    baseHigh: o.totals.high,
    low: o.totals.low + delta.low,
    exp: o.totals.expected + delta.exp,
    high: o.totals.high + delta.high,
    delta,
    hours,
    selfCount: items.length,
    bvCount,
    items,
  };
}

export interface TaskContext {
  owners: Record<string, Owner>;
  taskStatus: Record<string, TaskStatus>;
  planApproved: boolean;
  consultBooked: boolean;
  now: Date;
}

export function statusOf(t: PlanTask, ctx: TaskContext): TaskStatus {
  if (t.na) return "na";
  const override = ctx.taskStatus[t.id];
  if (override) return override;
  if (t.id === "consult" && ctx.consultBooked) return "in_progress";
  if (ownerOf(t, ctx.owners) === "bv" && ctx.planApproved) {
    const daysLeft = (t.due.getTime() - ctx.now.getTime()) / 86400000;
    return daysLeft <= 4 ? "in_progress" : "not_started";
  }
  return "not_started";
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  na: "Not needed",
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

/* =====================================================================
   Costs during the case
   ===================================================================== */

export function depositFor(o: OptionResult): number {
  const treatment = o.lines.find((l) => l.id === "treatment")?.expected ?? 0;
  return round100(treatment * 0.33);
}

export interface ChangeRequest {
  id: string;
  title: string;
  amount: number;
  why: string;
  cheaper?: { amount: number; text: string };
}

export function pendingChange(intake: Intake, o: OptionResult): ChangeRequest {
  const dx: DxId = intake.diagnosis ?? "other";
  const origin = ORIGIN_BY_ID[intake.origin ?? "other"];
  const info = DX_INFO[dx];
  const op = dx === "colon" || dx === "breast" ? "the operation" : "treatment";
  const req: ChangeRequest = {
    id: "extra-scan",
    title: info.scanTitle,
    amount: o.hospital.scanCost,
    why: `${o.specialist.name}'s team wants a fresh scan to plan ${op}. Their rule is scans within 4 weeks of treatment, so an older scan may need repeating.`,
  };
  if (origin.scanAtHome < o.hospital.scanCost * 0.8 && !o.visa.sameCountry) {
    req.cheaper = {
      amount: origin.scanAtHome,
      text: `Have the scan at home before travel instead — about ${usd(origin.scanAtHome)}, and the team has agreed to accept it.`,
    };
  } else if (origin.scanAtHome < o.hospital.scanCost * 0.8) {
    req.cheaper = {
      amount: origin.scanAtHome,
      text: `Have the scan near home before travel instead — about ${usd(origin.scanAtHome)}, and the team has agreed to accept it.`,
    };
  }
  return req;
}

/* =====================================================================
   Small helpers shared by pages
   ===================================================================== */

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function caseTitle(intake: Intake): string {
  const dx: DxId = intake.diagnosis ?? "other";
  const name = dx === "other" && intake.diagnosisOther.trim() ? intake.diagnosisOther.trim() : DX_INFO[dx].name;
  const stage = intake.stage && intake.stage !== "unsure" ? `Stage ${intake.stage} ` : "";
  const who = [intake.patientName.trim() || "Patient", intake.age ? intake.age : null].filter(Boolean).join(", ");
  return `${who} · ${stage}${name}`;
}

export function managedLine(intake: Intake): string {
  const patient = firstName(intake.patientName) || "The patient";
  if (intake.forWhom === "self") return "Managed by you";
  const rel = intake.relationship ? ` (${intake.relationship.toLowerCase()})` : "";
  const mgr = firstName(intake.managerName) || "a family member";
  const sees = intake.patientSeesAll ? `${patient} can see everything` : `${patient} sees what you share`;
  return `Managed by ${mgr}${rel} · ${sees}`;
}
