/** Browser requests never expose transport/parser details or discard a visitor's working choices. */
export async function carePlanApi<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, body === undefined ? { cache: "no-store" } : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("We couldn’t connect. Your choices remain on this device. Check your connection and try again.");
  }
  let value;
  try { value = await response.json(); }
  catch { throw new Error("We couldn’t read that response. Your choices remain on this device; please try again."); }
  if (!response.ok) {
    const messages: Record<string, string> = { unauthorized: "Sign in to save your plan.", conflict: "This plan changed in another tab. Reload the saved plan before editing again.", rate_limited: "The sample search allowance is busy. Try again in a minute.", invalid_dates: "Choose real dates from today through the next 330 days, for a stay of 1–99 nights.", invalid_airports: "Choose a supported departure airport different from your destination.", selection_expired: "A sample travel selection changed or expired. Refresh flights and stays, choose again, then review your plan.", stay_selection_expired: "The sample stay quote expired. Search stays again and review a fresh quote.", flight_selection_changed: "Your flight choice changed. Search flights again.", not_found: "This plan is unavailable for this account.", sample_offer_only: "This offer is not available for sample planning." };
    throw new Error(messages[value?.error] ?? "We couldn’t complete that step. Your choices remain on this device; please try again.");
  }
  return value;
}
