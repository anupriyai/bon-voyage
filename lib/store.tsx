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

const KEY = "bon-voyage-store-v2";
const DAY = 86400000;

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

export interface CaseState {
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

function sampleState(id: string, email: string): CaseState {
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  const f = (name: string, size: number, daysAgo: number, docDate?: string): RecFile => ({
    name,
    size,
    at: ago(daysAgo),
    docDate,
    translated: true,
  });
  return {
    ...initialState(id),
    updatedAt: now.toISOString(),
    complete: true,
    sample: true,
    createdAt: now.toISOString(),
    draftStep: 5,
    intake: {
      forWhom: "family",
      patientName: "Yousef Al-Masri",
      age: "68",
      relationship: "Son",
      patientRelation: "father",
      managerName: "Omar",
      patientSeesAll: true,
      email,
      phone: "",
      contactVia: "email",
      diagnosis: "colon",
      diagnosisOther: "",
      stage: "3",
      origin: "jordan",
      originOther: "",
      originCity: "Irbid",
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
  if (file.translated !== undefined) return file.translated;
  return new Date(file.at).getTime() + 2 * DAY <= now.getTime();
}

export function translationDaysLeft(file: RecFile, now: Date): number {
  return Math.max(1, Math.ceil((new Date(file.at).getTime() + 2 * DAY - now.getTime()) / DAY));
}

/** Health history can be two quick answers instead of a document. */
export function isAnsweredInstead(itemId: string, state: CaseState): boolean {
  return itemId.endsWith(".conditions") && Object.keys(state.health).length >= 2;
}

/** An item is covered once a file is in, a courier is booked, a request is drafted or it was answered. */
export function itemHandled(itemId: string, state: CaseState): boolean {
  const e = state.records[itemId];
  return !!(e && (e.files.length > 0 || e.courier || e.requested)) || isAnsweredInstead(itemId, state);
}

export function recordProgress(state: CaseState, now: Date) {
  const items = recordsFor(state.intake.diagnosis).filter((r) => !r.optional);
  let ready = 0;
  let translating = 0;
  let missing = 0;
  for (const r of items) {
    const entry = state.records[r.id];
    const files = entry?.files ?? [];
    if (entry?.courier || entry?.requested || isAnsweredInstead(r.id, state)) ready += 1;
    else if (files.length === 0) missing += 1;
    else if (files.every((f) => isTranslated(f, now))) ready += 1;
    else translating += 1;
  }
  return { total: items.length, ready, translating, missing };
}

/* ---------- Accounts and saved cases ---------- */

interface Store {
  session: { email: string } | null;
  activeId: string | null;
  cases: Record<string, CaseState>;
}

const emptyStore = (): Store => ({ session: null, activeId: null, cases: {} });
const EMPTY_CASE = initialState();

export const normEmail = (e: string) => e.trim().toLowerCase();
const uid = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** A case belongs to whoever's email is on it. Unfinished drafts have no owner yet. */
export function ownedBy(c: CaseState, email: string): boolean {
  return c.complete && normEmail(c.intake.email) === normEmail(email);
}

/** Where to drop someone back into a case: the furthest step they have reached. */
export function resumePath(c: CaseState): string {
  if (c.planApprovedAt) return "/case/dashboard";
  if (c.chosenId) return "/case/plan";
  if (c.secondOpinionAt || c.secondOpinionSkipped) return "/case/options";
  if (Object.values(c.records).some((r) => r.files.length > 0)) return "/case/second-opinion";
  return "/case/records";
}

function latestIncomplete(cases: Record<string, CaseState>): CaseState | undefined {
  return Object.values(cases)
    .filter((c) => !c.complete)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

interface Ctx {
  /** The active case, or an empty placeholder when none is open. */
  state: CaseState;
  hasActive: boolean;
  ready: boolean;
  session: { email: string } | null;
  /** Finished cases belonging to the signed-in email, newest first. */
  myCases: CaseState[];
  /** The unfinished request in this browser, if the person has started filling one in. */
  draft: CaseState | null;
  update: (fn: (s: CaseState) => CaseState) => void;
  patch: (p: Partial<CaseState>) => void;
  setIntake: (p: Partial<Intake>) => void;
  /** Open the unfinished request (or start one), optionally pre-filling answers. */
  startDraft: (prefill?: Partial<Intake>, fresh?: boolean) => void;
  openCase: (id: string) => void;
  deleteCase: (id: string) => void;
  /** Sign in with an email that has saved cases. Returns the cases found (empty means no sign-in). */
  login: (email: string) => CaseState[];
  /** Create the session once a request has been submitted. */
  signIn: (email: string) => void;
  logout: () => void;
  loadSample: () => void;
  chatOpen: boolean;
  chatDraft: string;
  openChat: (draft?: string) => void;
  closeChat: () => void;
  sendChat: (text: string) => void;
}

const CaseContext = createContext<Ctx | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Store>;
        const cases: Record<string, CaseState> = {};
        for (const [id, c] of Object.entries(parsed.cases ?? {})) {
          cases[id] = { ...initialState(id), ...c, id, intake: { ...emptyIntake(), ...(c.intake ?? {}) } };
        }
        setStore({ session: parsed.session ?? null, activeId: parsed.activeId ?? null, cases });
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
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      // Storage full or blocked.
    }
  }, [store, ready]);

  const active = store.activeId ? store.cases[store.activeId] : undefined;
  const state = active ?? EMPTY_CASE;

  const updateCase = useCallback((id: string, fn: (s: CaseState) => CaseState) => {
    setStore((st) => {
      const cur = st.cases[id];
      if (!cur) return st;
      return { ...st, cases: { ...st.cases, [id]: { ...fn(cur), id, updatedAt: new Date().toISOString() } } };
    });
  }, []);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = store.activeId;

  const update = useCallback(
    (fn: (s: CaseState) => CaseState) => {
      if (activeIdRef.current) updateCase(activeIdRef.current, fn);
    },
    [updateCase],
  );
  const patch = useCallback((p: Partial<CaseState>) => update((s) => ({ ...s, ...p })), [update]);
  const setIntake = useCallback(
    (p: Partial<Intake>) => update((s) => ({ ...s, intake: { ...s.intake, ...p } })),
    [update],
  );

  const startDraft = useCallback((prefill?: Partial<Intake>, fresh?: boolean) => {
    setStore((st) => {
      const cases = { ...st.cases };
      if (fresh) for (const c of Object.values(cases)) if (!c.complete) delete cases[c.id];
      const activeCase = st.activeId ? cases[st.activeId] : undefined;
      let draft = activeCase && !activeCase.complete ? activeCase : latestIncomplete(cases);
      if (!draft) {
        const id = uid();
        draft = {
          ...initialState(id),
          updatedAt: new Date().toISOString(),
          intake: { ...emptyIntake(), email: st.session?.email ?? "" },
        };
      }
      cases[draft.id] = { ...draft, intake: { ...draft.intake, ...(prefill ?? {}) } };
      return { ...st, activeId: draft.id, cases };
    });
  }, []);

  const openCase = useCallback((id: string) => setStore((st) => (st.cases[id] ? { ...st, activeId: id } : st)), []);

  const deleteCase = useCallback(
    (id: string) =>
      setStore((st) => {
        const cases = { ...st.cases };
        delete cases[id];
        return { ...st, cases, activeId: st.activeId === id ? null : st.activeId };
      }),
    [],
  );

  const login = useCallback(
    (email: string) => {
      const e = normEmail(email);
      const found = Object.values(store.cases)
        .filter((c) => ownedBy(c, e))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      if (found.length > 0) {
        setStore((st) => ({ ...st, session: { email: e }, activeId: found.length === 1 ? found[0].id : null }));
      }
      return found;
    },
    [store.cases],
  );

  const signIn = useCallback(
    (email: string) => setStore((st) => ({ ...st, session: { email: normEmail(email) } })),
    [],
  );
  const logout = useCallback(() => {
    setChatOpen(false);
    setStore((st) => ({ ...st, session: null, activeId: null }));
  }, []);

  const loadSample = useCallback(() => {
    setStore((st) => {
      const id = uid();
      const email = st.session?.email ?? "omar@example.com";
      return {
        ...st,
        session: st.session ?? { email },
        activeId: id,
        cases: { ...st.cases, [id]: sampleState(id, email) },
      };
    });
  }, []);

  const openChat = useCallback((draftText?: string) => {
    setChatDraft(draftText ?? "");
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const sendChat = useCallback(
    (text: string) => {
      const clean = text.trim();
      const id = activeIdRef.current;
      if (!clean || !id) return;
      updateCase(id, (s) => ({ ...s, chat: [...s.chat, { from: "you", text: clean, at: new Date().toISOString() }] }));
      setChatDraft("");
      const t = window.setTimeout(() => {
        updateCase(id, (s) => ({
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
    },
    [updateCase],
  );

  const myCases = useMemo(() => {
    const email = store.session?.email;
    if (!email) return [];
    return Object.values(store.cases)
      .filter((c) => ownedBy(c, email))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [store.cases, store.session]);

  const draft = useMemo(() => {
    const d = latestIncomplete(store.cases);
    return d && d.intake.patientName.trim() ? d : null;
  }, [store.cases]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      hasActive: !!active,
      ready,
      session: store.session,
      myCases,
      draft,
      update,
      patch,
      setIntake,
      startDraft,
      openCase,
      deleteCase,
      login,
      signIn,
      logout,
      loadSample,
      chatOpen,
      chatDraft,
      openChat,
      closeChat,
      sendChat,
    }),
    [state, active, ready, store.session, myCases, draft, update, patch, setIntake, startDraft, openCase, deleteCase, login, signIn, logout, loadSample, chatOpen, chatDraft, openChat, closeChat, sendChat],
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
