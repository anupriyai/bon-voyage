import { describe, expect, it } from "vitest";
import { CaseSync, mergeSavedCases } from "./sync";
import { initialState } from "../model/caseState";

const state = initialState("a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36");
describe("case autosave", () => {
  it("loads the server copy and cannot resurrect a remotely deleted case", () => {
    const deleted = { ...state, id: "deleted-id" };
    const draft = { ...state, id: "unsaved-draft" };
    const remote = { ...state, draftStep: 4 };
    const merged = mergeSavedCases({ [state.id]: state, [deleted.id]: deleted, [draft.id]: draft }, [state.id, deleted.id], [{ state: remote, revision: 3 }]);
    expect(merged[state.id]).toEqual(remote);
    expect(merged[deleted.id]).toBeUndefined();
    expect(merged[draft.id]).toEqual(draft);
  });
  it("serializes edits made during an in-flight save using the returned revision", async () => {
    const revisions: (number | null)[] = [];
    const sync = new CaseSync(async (s, revision) => {
      revisions.push(revision);
      await Promise.resolve();
      return { state: s, revision: (revision ?? 0) + 1 };
    });
    await Promise.all([sync.save(state), sync.save({ ...state, draftStep: 2 })]);
    expect(revisions).toEqual([null, 1]);
  });
  it("deletion waits for an in-flight save and prevents queued edits from recreating it", async () => {
    const versions: (number | null)[] = [];
    const sync = new CaseSync(async (s, revision) => {
      await Promise.resolve();
      return { state: s, revision: (revision ?? 0) + 1 };
    });
    const saving = sync.save(state);
    await Promise.resolve();
    const removing = sync.remove(state.id, async (revision) => { versions.push(revision); });
    await Promise.all([saving, removing, sync.save({ ...state, draftStep: 3 })]);
    expect(versions).toEqual([1]);
    expect(sync.pending(state)).toBe(false);
  });
  it("does not overwrite a conflicting remote revision or retry blindly", async () => {
    let calls = 0;
    const sync = new CaseSync(async () => { calls++; throw new Error("conflict"); });
    await expect(sync.save(state)).rejects.toThrow("conflict");
    await expect(sync.save({ ...state, draftStep: 2 })).rejects.toThrow("conflict");
    expect(calls).toBe(1);
  });
  it("does not re-save an unchanged hydrated case or persist demo cases", async () => {
    let calls = 0;
    const sync = new CaseSync(async (s) => { calls++; return { state: s, revision: 4 }; });
    sync.hydrate([{ state, revision: 3 }]);
    await sync.save(state);
    await sync.save({ ...state, sample: true });
    expect(calls).toBe(0);
  });
});
