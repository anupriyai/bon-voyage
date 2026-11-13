import type { CaseState } from "../model/caseState";

export interface SavedCase { state: CaseState; revision: number }

/** Server copies win; a case previously saved but missing remotely was deleted on another device. */
export function mergeSavedCases(local: Record<string, CaseState>, savedIds: string[], remote: SavedCase[]) {
  const cases = { ...local };
  const remoteIds = new Set(remote.map((row) => row.state.id));
  for (const id of savedIds) if (!remoteIds.has(id)) delete cases[id];
  for (const row of remote) cases[row.state.id] = row.state;
  return cases;
}

/** Serialize saves so edits made during a request use its new revision. Conflicts require a reload. */
export class CaseSync {
  private tail: Promise<unknown> = Promise.resolve();
  private versions = new Map<string, number>();
  private saved = new Map<string, string>();
  private conflict = false;
  private removed = new Set<string>();
  constructor(private write: (state: CaseState, revision: number | null) => Promise<SavedCase>) {}
  hydrate(rows: SavedCase[]) {
    for (const row of rows) {
      this.versions.set(row.state.id, row.revision);
      this.saved.set(row.state.id, JSON.stringify(row.state));
    }
  }
  revision(id: string) { return this.versions.get(id) ?? null; }
  pending(state: CaseState) { return !this.removed.has(state.id) && !state.sample && this.saved.get(state.id) !== JSON.stringify(state); }
  async idle() { await this.tail; }
  remove(id: string, removeRemote: (revision: number | null) => Promise<void>) {
    this.removed.add(id);
    const work = this.tail.then(async () => {
      try {
        await removeRemote(this.revision(id));
        this.versions.delete(id);
        this.saved.delete(id);
      } catch (error) {
        this.removed.delete(id);
        if (error instanceof Error && error.message === "conflict") this.conflict = true;
        throw error;
      }
    });
    this.tail = work.catch(() => {});
    return work;
  }
  save(state: CaseState): Promise<void> {
    const work = this.tail.then(async () => {
      if (this.conflict) throw new Error("conflict");
      if (!this.pending(state)) return;
      try {
        const result = await this.write(state, this.revision(state.id));
        this.versions.set(state.id, result.revision);
        // Retain the submitted fingerprint: server timestamps must not cause an endless save loop.
        this.saved.set(state.id, JSON.stringify(state));
      } catch (error) {
        if (error instanceof Error && error.message === "conflict") this.conflict = true;
        throw error;
      }
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
