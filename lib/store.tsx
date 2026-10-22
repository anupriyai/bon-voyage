"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PRIORITIES,
  emptyIntake,
  recordsFor,
  COORDINATOR,
  type HospitalId,
  type Intake,
} from "./data";
import {
  buildPlan,
  evaluateAll,
  firstName,
  matchedOptions,
  planImpact,
  type CostView,
  type Owner,
  type TaskStatus,
} from "./engine";

const KEY = "bon-voyage-case-v1";
const DAY = 86400000;

export interface RecFile {
  name: string;
  size: number;
  at: string;
  docDate?: string;
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

export interface CaseState {
  intake: Intake;
  draftStep: number;
  complete: boolean;
  createdAt: string | null;
  sample: boolean;
  records: Record<string, { files: RecFile[]; courier?: boolean }>;
  unsorted: RecFile[];
  secondOpinionAt: string | null;
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

export function initialState(): CaseState {
  return {
    intake: emptyIntake(),
    draftStep: 1,
    complete: false,
    createdAt: null,
    sample: false,
    records: {},
    unsorted: [],
    secondOpinionAt: null,
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

function sampleState(): CaseState {
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  const f = (name: string, size: number, daysAgo: number, docDate?: string): RecFile => ({
    name,
    size,
    at: ago(daysAgo),
    docDate,
  });
  return {
    ...initialState(),
    complete: true,
    sample: true,
    createdAt: now.toISOString(),
    draftStep: 5,
    intake: {
      forWhom: "family",
      patientName: "Yousef Al-Masri",
      age: "68",
      relationship: "Son",
      managerName: "Omar",
      patientSeesAll: true,
      email: "omar@example.com",
      phone: "",
      contactVia: "email",
      diagnosis: "colon",
      diagnosisOther: "",
      stage: "3",
      origin: "jordan",
      originOther: "",
      languages: ["arabic"],
      priorities: [...DEFAULT_PRIORITIES],
      budget: "25-50",
      insurance: "self",
      destinations: ["home", "gulf", "levant", "turkey", "europe"],
      timeline: "month",
    },
    records: {
      "colon.ct": { files: [f("ct-chest-abdomen-pelvis.pdf", 4_200_000, 9, "28 Sep 2026")] },
      "colon.scope": { files: [f("colonoscopy-report.pdf", 1_900_000, 9, "10 Sep 2026")] },
      "colon.biopsy": { files: [f("biopsy-pathology.pdf", 820_000, 0, "12 Sep 2026")] },
      "colon.blood": { files: [f("blood-tests.jpg", 640_000, 9, "1 Oct 2026")] },
      "colon.cea": { files: [f("cea-marker.jpg", 410_000, 9, "1 Oct 2026")] },
      "colon.letter": { files: [f("doctor-letter.pdf", 300_000, 9)] },
      "colon.meds": { files: [f("medication-list.jpg", 520_000, 9)] },
    },
    chat: [
      {
        from: "coordinator",
        at: now.toISOString(),
        text: coordinatorGreeting("Omar"),
      },
    ],
  };
}

export function coordinatorGreeting(name: string): string {
  return `Hi ${name || "there"}, I'm ${firstName(COORDINATOR.name)}, your care coordinator. I'm here in Arabic and English. Ask me anything about the records, the options or the plan, and I'll reply within 2 hours between 8am and 8pm.`;
}

/* ---------- Records helpers ---------- */

export function isTranslated(file: RecFile, now: Date): boolean {
  return new Date(file.at).getTime() + 2 * DAY <= now.getTime();
}

export function translationDaysLeft(file: RecFile, now: Date): number {
  return Math.max(1, Math.ceil((new Date(file.at).getTime() + 2 * DAY - now.getTime()) / DAY));
}

export function recordProgress(state: CaseState, now: Date) {
  const items = recordsFor(state.intake.diagnosis).filter((r) => !r.optional);
  let ready = 0;
  let translating = 0;
  let missing = 0;
  for (const r of items) {
    const files = state.records[r.id]?.files ?? [];
    if (files.length === 0) missing += 1;
    else if (files.every((f) => isTranslated(f, now))) ready += 1;
    else translating += 1;
  }
  return { total: items.length, ready, translating, missing };
}

/* ---------- Context ---------- */

interface Ctx {
  state: CaseState;
  ready: boolean;
  update: (fn: (s: CaseState) => CaseState) => void;
  patch: (p: Partial<CaseState>) => void;
  setIntake: (p: Partial<Intake>) => void;
  loadSample: () => void;
  resetCase: () => void;
  chatOpen: boolean;
  chatDraft: string;
  openChat: (draft?: string) => void;
  closeChat: () => void;
  sendChat: (text: string) => void;
}

const CaseContext = createContext<Ctx | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CaseState>(initialState);
  const [ready, setReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CaseState>;
        setState({ ...initialState(), ...parsed, intake: { ...emptyIntake(), ...(parsed.intake ?? {}) } });
      }
    } catch {
      // Ignore unreadable or blocked storage; the app works without it.
    }
    setReady(true);
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked.
    }
  }, [state, ready]);

  const update = useCallback((fn: (s: CaseState) => CaseState) => setState(fn), []);
  const patch = useCallback((p: Partial<CaseState>) => setState((s) => ({ ...s, ...p })), []);
  const setIntake = useCallback(
    (p: Partial<Intake>) => setState((s) => ({ ...s, intake: { ...s.intake, ...p } })),
    [],
  );
  const loadSample = useCallback(() => setState(sampleState()), []);
  const resetCase = useCallback(() => {
    setState(initialState());
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }, []);

  const openChat = useCallback((draft?: string) => {
    setChatDraft(draft ?? "");
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const sendChat = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const at = new Date().toISOString();
    setState((s) => ({ ...s, chat: [...s.chat, { from: "you", text: clean, at }] }));
    setChatDraft("");
    const t = window.setTimeout(() => {
      setState((s) => ({
        ...s,
        chat: [
          ...s.chat,
          {
            from: "coordinator",
            at: new Date().toISOString(),
            text: "Thank you, I've noted that. I'll check with the hospital and reply here within 2 hours (8am–8pm). If it's urgent, tell me and I'll call.",
          },
        ],
      }));
    }, 1400);
    timers.current.push(t);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      update,
      patch,
      setIntake,
      loadSample,
      resetCase,
      chatOpen,
      chatDraft,
      openChat,
      closeChat,
      sendChat,
    }),
    [state, ready, update, patch, setIntake, loadSample, resetCase, chatOpen, chatDraft, openChat, closeChat, sendChat],
  );

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): Ctx {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase must be used inside CaseProvider");
  return ctx;
}

/** Everything derived from the current answers: matched options, the chosen option, the plan and its price impact. */
export function useCaseModel() {
  const { state } = useCase();
  const { intake, chosenId, chosenAt, owners } = state;

  return useMemo(() => {
    const matched = matchedOptions(intake);
    const all = evaluateAll(intake);
    const chosen = all.find((o) => o.hospital.id === chosenId) ?? null;
    const plan = chosen && chosenAt ? buildPlan(intake, chosen, chosenAt) : null;
    const impact = chosen && plan ? planImpact(chosen, plan, owners) : null;
    return { options: matched.options, widened: matched.widened, chosen, plan, impact };
  }, [intake, chosenId, chosenAt, owners]);
}
