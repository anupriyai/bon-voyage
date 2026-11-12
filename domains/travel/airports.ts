import type { CaseState, HospitalId, OriginId } from "@/domains/case";

export const HOSPITAL_AIRPORTS: Record<HospitalId, string> = { amman: "AMM", cairo: "CAI", istanbul: "IST", dubai: "DXB", berlin: "BER" };
const ORIGIN_AIRPORTS: Partial<Record<OriginId, string>> = { jordan: "AMM", saudi: "RUH", uae: "AUH", lebanon: "BEY", egypt: "CAI", uk: "LHR", nz: "AKL" };
const CITIES: Record<string, string> = { amman: "AMM", irbid: "AMM", aqaba: "AQJ", riyadh: "RUH", jeddah: "JED", dubai: "DXB", "abu dhabi": "AUH", beirut: "BEY", cairo: "CAI", alexandria: "CAI", istanbul: "IST", berlin: "BER", london: "LHR", auckland: "AKL" };

export function airportsFor(state: CaseState): { from: string; to: string } {
  const city = state.intake.originCity.trim().toLowerCase();
  const from = CITIES[city] ?? (state.intake.origin ? ORIGIN_AIRPORTS[state.intake.origin] : undefined);
  const to = state.chosenId ? HOSPITAL_AIRPORTS[state.chosenId] : undefined;
  if (!from || !to) throw new Error("Choose a supported origin and a hospital before searching.");
  if (from === to) throw new Error("Your hospital uses your home airport. Continue with local transport in your plan.");
  return { from, to };
}
