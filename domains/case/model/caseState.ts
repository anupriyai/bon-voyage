import { emptyIntake, type Intake, type HospitalId } from "../data/catalogue";
import type { CostView, Owner, TaskStatus } from "./engine";

export interface RecFile {
  name: string;
  size: number;
  at: string;
  docDate?: string;
  /** What the assistant recognised the file as. */
  found?: string;
  /** Set once the assistant has read (and if needed translated) the file. */
  translated?: boolean;
}

export interface RecordEntry {
  files: RecFile[];
  /** Physical samples: a medical courier collects them. */
  courier?: boolean;
  /** The assistant drafted a request (lab test, letter) for the coordinator to send. */
  requested?: boolean;
}

export interface ChatMsg {
  from: "you" | "coordinator";
  text: string;
  at: string;
}

export interface ApprovedChange {
  id: string;
  label: string;
  amount: number;
  at: string;
}

export interface TravelSchedule {
  appointment: string;
  treatmentDays: number;
  recoveryDays: number;
  passengers: number;
  companionAges?: number[];
  wheelchair: boolean;
  flexDays: 0 | 1;
}
export interface FlightSelection {
  id: string;
  amount: number;
  currency: string;
  usdAmount?: number;
  fareAmount?: number;
  fees?: number;
  extraGround?: number;
  mode?: "sample" | "test" | "live";
  searchId?: string;
  context: string;
  from: string;
  to: string;
  out: string;
  back: string;
  sample: boolean;
  selectedAt: string;
}
export interface StaySelection {
  localQuoteId: string; quoteId: string; name: string; amount: number; currency: string;
  dueAtAccommodation: number | null; dueCurrency: string; usdAmount: number; context: string;
  checkIn: string; checkOut: string; sample: boolean;
}
export interface CaseState {
  staySelection: StaySelection | null;
  travelSchedule: TravelSchedule | null;
  flightSelection: FlightSelection | null;
  id: string;
  updatedAt: string;
  intake: Intake;
  draftStep: number;
  complete: boolean;
  createdAt: string | null;
  sample: boolean;
  records: Record<string, RecordEntry>;
  unsorted: RecFile[];
  secondOpinionAt: string | null;
  secondOpinionSkipped: boolean;
  passportAdded: boolean;
  /** Answers to the short health-history questions, instead of a document. */
  health: Record<string, string>;
  costView: CostView;
  chosenId: HospitalId | null;
  chosenAt: string | null;
  owners: Record<string, Owner>;
  taskStatus: Record<string, TaskStatus>;
  consultSlot: string | null;
  planApprovedAt: string | null;
  scanDecision: "pending" | "approved" | "cheaper";
  approved: ApprovedChange[];
  chat: ChatMsg[];
}

export function initialState(id = ""): CaseState {
  return {
    id,
    staySelection: null,
    travelSchedule: null,
    flightSelection: null,
    updatedAt: new Date(0).toISOString(),
    intake: emptyIntake(),
    draftStep: 1,
    complete: false,
    createdAt: null,
    sample: false,
    records: {},
    unsorted: [],
    secondOpinionAt: null,
    secondOpinionSkipped: false,
    passportAdded: false,
    health: {},
    costView: "expected",
    chosenId: null,
    chosenAt: null,
    owners: {},
    taskStatus: {},
    consultSlot: null,
    planApprovedAt: null,
    scanDecision: "pending",
    approved: [],
    chat: [],
  };
}


export function flightContext(state: CaseState): string {
  return JSON.stringify([state.id, state.intake.age, state.intake.origin, state.intake.originCity.trim().toLowerCase(), state.chosenId, state.intake.stage, state.travelSchedule]);
}
export function selectedFlightFor(state: CaseState): FlightSelection | null {
  const flight = state.flightSelection;
  return flight?.context === flightContext(state) && (flight.currency === "USD" || typeof flight.usdAmount === "number") ? flight : null;
}

export function selectedStayFor(state: CaseState): StaySelection | null {
  return state.staySelection?.context === flightContext(state) ? state.staySelection : null;
}

export function updatedFlightPrice(selection: FlightSelection, fareAmount: number, usdPerUnit: number): FlightSelection {
  const amount = fareAmount + (selection.fees ?? 0) + (selection.extraGround ?? 0);
  return { ...selection, fareAmount, amount, usdAmount: amount * usdPerUnit };
}
