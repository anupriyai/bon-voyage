import { HOSPITAL_BY_ID } from "./data";
import { plural } from "./format";
import { recordProgress, type CaseState } from "./store";

export function hospitalLabel(c: CaseState): string {
  const h = c.chosenId ? HOSPITAL_BY_ID[c.chosenId] : null;
  return h ? `${h.name}, ${h.city}` : "";
}

export function recordProgressLabel(c: CaseState): string {
  const p = recordProgress(c, new Date());
  if (p.ready === 0 && p.translating === 0) return "Add medical records";
  return `${p.ready} of ${plural(p.total, "record")} ready`;
}
