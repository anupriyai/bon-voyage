import { actorFrom } from "@/domains/account";
import { getCaseStore } from "@/domains/case/server";
import { getFlightProvider, getSearchStore } from "@/domains/travel/server";
import { createFlightSearchHandler } from "@/domains/pricing/handlers";

export const runtime = "nodejs";
export const POST = createFlightSearchHandler({
  actorFrom,
  loadCase: (actor, id) => getCaseStore().loadCase(actor, id),
  reserve: (...args) => getSearchStore().reserve(...args),
  snapshots: (...args) => getSearchStore().snapshots(...args),
  provider: getFlightProvider,
});
