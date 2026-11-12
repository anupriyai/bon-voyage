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
import { authClient } from "@/domains/account/client";
import { CaseSync, mergeSavedCases, type SavedCase } from "./sync";
import {
  DEFAULT_PRIORITIES,
  emptyIntake,
  recordsFor,
  COORDINATOR,
  type Intake,
} from "@/domains/case/data/catalogue";
import {
  buildPlan,
  applyFlightCost,
  applyStayCost,
  evaluateAll,
  firstName,
  matchedOptions,
  planImpact,
} from "@/domains/case/model/engine";

const KEY = "bon-voyage-store-v2";
const DAY = 86400000;

export { initialState } from "../model/caseState";
export type { RecFile, RecordEntry, ChatMsg, ApprovedChange, CaseState } from "../model/caseState";
import { initialState, selectedFlightFor, selectedStayFor, type CaseState, type RecFile } from "../model/caseState";

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
  savedIds?: string[];
  session: { email: string } | null;
  activeId: string | null;
  cases: Record<string, CaseState>;
}

const emptyStore = (): Store => ({ session: null, activeId: null, cases: {} });
const EMPTY_CASE = initialState();

export const normEmail = (e: string) => e.trim().toLowerCase();
const uid = () => crypto.randomUUID();

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
  /** Completed cases from the verified account, newest first. */
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
  saveStatus: "device" | "loading" | "saving" | "saved" | "error" | "conflict";
  saveNow: () => Promise<void>;
  reloadCases: () => void;
  logout: () => Promise<void>;
  loadSample: () => void;
  chatOpen: boolean;
  chatDraft: string;
  openChat: (draft?: string) => void;
  closeChat: () => void;
  sendChat: (text: string) => void;
}

const CaseContext = createContext<Ctx | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const { data: authSession, isPending, error: authError } = authClient.useSession();
  const session = authSession?.user ? { id: authSession.user.id, email: authSession.user.email } : null;
  const accountId = session?.id ?? "guest";
  const [store, setStore] = useState<Store>(emptyStore);
  const [readyAccount, setReadyAccount] = useState<string | null>(null);
  const ready = !isPending && readyAccount === accountId;
  const [saveStatus, setSaveStatus] = useState<Ctx["saveStatus"]>("loading");
  const [reload, setReload] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const timers = useRef<number[]>([]);
  const sync = useRef<CaseSync | null>(null);
  const latest = useRef(store);
  latest.current = store;
  const identity = useRef(accountId);
  identity.current = accountId;

  useEffect(() => {
    if (isPending) return;
    let cancelled = false;
    const controller = new AbortController();
    setReadyAccount(null);
    setSaveStatus("loading");
    sync.current = null;
    const read = (key: string): Store => {
      try {
        const value = JSON.parse(window.localStorage.getItem(key) ?? "null");
        if (!value?.cases) return emptyStore();
        const cases: Record<string, CaseState> = {};
        for (const c of Object.values(value.cases) as CaseState[]) {
          // Legacy browser IDs are upgraded before they can reach the database.
          const id = /^[0-9a-f-]{36}$/i.test(c.id) ? c.id : uid();
          cases[id] = { ...initialState(id), ...c, id, intake: { ...emptyIntake(), ...c.intake } };
        }
        return { session: null, savedIds: value.savedIds ?? [], cases, activeId: cases[value.activeId]?.id ?? Object.keys(cases)[0] ?? null };
      } catch { return emptyStore(); }
    };
    async function load() {
      const key = `${KEY}:${accountId}`;
      let local = read(key);
      if (accountId === "guest" && !Object.keys(local.cases).length) {
        local = read(KEY);
        try {
          window.localStorage.setItem(key, JSON.stringify(local));
          window.localStorage.removeItem(KEY);
        } catch { /* Keep the legacy copy if storage is blocked. */ }
      }
      const pending = session ? read(`${KEY}:guest`) : emptyStore();
      if (session) {
        for (const c of Object.values(pending.cases)) {
          if (!c.sample && normEmail(c.intake.email) === normEmail(session.email)) {
            local.cases[c.id] ??= c;
            local.activeId ??= c.id;
          }
        }
      }
      try {
        if (authError) throw new Error("session_unavailable");
        if (session) {
          const response = await fetch("/api/case", { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("load_failed");
          const data = await response.json() as { cases: SavedCase[] };
          if (cancelled) return;
          const writer = new CaseSync(async (state, revision) => {
            if (identity.current !== accountId) throw new Error("account_changed");
            const response = await fetch("/api/case", {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state, revision }),
            });
            if (!response.ok) throw new Error(response.status === 409 ? "conflict" : "save_failed");
            const saved = await response.json();
            if (identity.current === accountId) setStore((st) => ({ ...st, savedIds: [...new Set([...(st.savedIds ?? []), state.id])] }));
            return saved;
          });
          writer.hydrate(data.cases);
          // Server copies win; only genuinely unsaved local drafts are adopted.
          const cases = mergeSavedCases(local.cases, local.savedIds ?? [], data.cases);
          const remoteIds = new Set(data.cases.map((row) => row.state.id));
          local = { session: { email: session.email }, savedIds: [...remoteIds], cases, activeId: local.activeId && cases[local.activeId] ? local.activeId : data.cases[0]?.state.id ?? null };
          sync.current = writer;
          // A draft is transferred once, so deleting it remotely cannot resurrect it later.
          for (const id of Object.keys(pending.cases)) if (cases[id] && !pending.cases[id].sample) delete pending.cases[id];
          try {
            window.localStorage.setItem(key, JSON.stringify(local));
            window.localStorage.setItem(`${KEY}:guest`, JSON.stringify(pending));
          } catch { /* Preserve the guest copy if the transfer could not be stored. */ }
        }
        if (!cancelled) { setStore(local); setSaveStatus(session ? "saved" : "device"); }
      } catch {
        if (!cancelled) { setStore({ ...local, session: session ? { email: session.email } : null }); setSaveStatus("error"); }
      } finally {
        if (!cancelled) setReadyAccount(accountId);
      }
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [accountId, session?.email, isPending, authError, reload]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(`${KEY}:${accountId}`, JSON.stringify({ ...store, session: null })); }
    catch { if (!session) setSaveStatus("error"); }
  }, [store, ready, accountId]);

  const saveNow = useCallback(async () => {
    const writer = sync.current;
    const owner = identity.current;
    if (!writer) throw new Error("Sign in and reload your cases before saving.");
    setSaveStatus("saving");
    try {
      for (const c of Object.values(latest.current.cases)) if (!c.sample) await writer.save(c);
      if (identity.current === owner) setSaveStatus(Object.values(latest.current.cases).some((c) => writer.pending(c)) ? "saving" : "saved");
    } catch (error) {
      if (identity.current === owner) setSaveStatus(error instanceof Error && error.message === "conflict" ? "conflict" : "error");
      throw error;
    }
  }, []);
  useEffect(() => {
    if (!ready || !sync.current) return;
    if (!Object.values(store.cases).some((c) => sync.current!.pending(c))) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => { void saveNow().catch(() => {}); }, 650);
    return () => window.clearTimeout(timer);
  }, [store.cases, ready, saveNow]);
  const reloadCases = useCallback(() => setReload((n) => n + 1), []);

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
      const activeCase = st.activeId ? cases[st.activeId] : undefined;
      let draft = fresh ? undefined : activeCase && !activeCase.complete ? activeCase : latestIncomplete(cases);
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

  const deleteCase = useCallback((id: string) => {
    const remove = async () => {
      const c = latest.current.cases[id];
      if (!c) return;
      try {
        if (!c.sample && session) {
          const writer = sync.current;
          if (!writer) throw new Error("not_ready");
          await writer.remove(id, async (revision) => {
            if (revision !== null) {
              const response = await fetch(`/api/case?id=${id}&revision=${revision}`, { method: "DELETE" });
              if (!response.ok) throw new Error(response.status === 409 ? "conflict" : "delete_failed");
            }
          });
        }
        setStore((st) => {
          const cases = { ...st.cases };
          delete cases[id];
          return { ...st, cases, savedIds: st.savedIds?.filter((saved) => saved !== id), activeId: st.activeId === id ? null : st.activeId };
        });
      } catch (error) { setSaveStatus(error instanceof Error && error.message === "conflict" ? "conflict" : "error"); }
    };
    void remove();
  }, [session?.id]);

  const logout = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) { setSaveStatus("error"); return; }
    setChatOpen(false);
    document.cookie = "bv_demo=; Path=/; Max-Age=0; SameSite=Lax";
    setStore(emptyStore());
  }, []);

  const loadSample = useCallback(() => {
    document.cookie = "bv_demo=1; Path=/; SameSite=Lax; Max-Age=86400";
    setStore((st) => {
      const id = uid();
      const email = st.session?.email ?? "omar@example.com";
      return {
        ...st,
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

  const myCases = useMemo(() => Object.values(store.cases)
    .filter((c) => c.complete && (!!session || c.sample))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [store.cases, session?.id]);

  const draft = useMemo(() => {
    const d = latestIncomplete(store.cases);
    return d && d.intake.patientName.trim() ? d : null;
  }, [store.cases]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      hasActive: !!active,
      ready,
      session,
      myCases,
      draft,
      update,
      patch,
      setIntake,
      startDraft,
      openCase,
      deleteCase,
      saveStatus,
      saveNow,
      reloadCases,
      logout,
      loadSample,
      chatOpen,
      chatDraft,
      openChat,
      closeChat,
      sendChat,
    }),
    [state, active, ready, session?.id, session?.email, saveStatus, saveNow, reloadCases, myCases, draft, update, patch, setIntake, startDraft, openCase, deleteCase, logout, loadSample, chatOpen, chatDraft, openChat, closeChat, sendChat],
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
  const flight = selectedFlightFor(state);
  const stay = selectedStayFor(state);

  return useMemo(() => {
    const matched = matchedOptions(intake);
    const all = evaluateAll(intake);
    const baseChosen = all.find((o) => o.hospital.id === chosenId) ?? null;
    const flightChosen = baseChosen && flight ? applyFlightCost(baseChosen, flight.usdAmount ?? flight.amount) : baseChosen;
    const chosen = flightChosen && stay ? applyStayCost(flightChosen, stay.usdAmount) : flightChosen;
    const plan = chosen && chosenAt ? buildPlan(intake, chosen, chosenAt, flight && state.travelSchedule ? { appointment: state.travelSchedule.appointment, out: flight.out, back: flight.back } : undefined) : null;
    const impact = chosen && plan ? planImpact(chosen, plan, owners) : null;
    return { options: matched.options, widened: matched.widened, chosen, plan, impact };
  }, [intake, chosenId, chosenAt, owners, flight, stay, state.travelSchedule]);
}
