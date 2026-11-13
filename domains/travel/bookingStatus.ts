export function canApplyBookingStatus(from: string, to: string) {
  if (from === "cancelled") return to === "cancelled";
  if (from === "cancel_requested") return ["cancel_requested", "cancelled"].includes(to);
  if (from === "confirmed") return ["confirmed", "cancel_requested", "cancelled"].includes(to);
  if (from === "payment_checking") return ["payment_checking", "confirmed", "cancelled"].includes(to);
  return true;
}
