# Provider contracts for phases 5–10

Checked against official provider documentation during implementation, 2026-10-27. This is an implementation reference, not evidence that external accounts, carrier access, live booking or production deployment have been verified. No provider requests, bookings or emails were made for this research.

## Duffel request boundary

Use server-side requests to `https://api.duffel.com` with `Authorization: Bearer …`, `Duffel-Version: v2`, `Accept: application/json`, and `Content-Type: application/json` for JSON bodies. Request bodies use the `{ data: … }` envelope. Capture `x-request-id` for operational correlation; never log request bodies or tokens. `x-client-correlation-id` is documented for correlation, **not provider-side idempotency**. A local durable booking claim is still required before the network request. [Making requests](https://duffel.com/docs/api/overview/making-requests)

The official JavaScript library is `@duffel/api`, constructed with `new Duffel({ token })`. The roadmap pins `4.31.0`; inspect that installed release's TypeScript signatures before using SDK options. Keep its imports in the server adapter. HTTP contracts below are verified; this research did not install or verify that release's constructor/retry implementation. [JavaScript client guide](https://duffel.com/docs/guides/javascript-client-library)

## Flight search and mapping

- `POST /air/offer_requests`: one slice for one way, two for return. Each slice uses `origin`, `destination`, `departure_date`; body also carries `passengers`, `cabin_class`, `max_connections`.
- `supplier_timeout=10000` and `return_offers=false` are **query parameters**, not body properties. The documented supplier timeout range is 2,000–60,000 milliseconds. Use a longer client timeout.
- With `return_offers=false`, subsequently request `GET /air/offers?offer_request_id=…&sort=total_amount`; budget the actual HTTP requests, including pagination, separately from the number of airline searches.

[Offer requests](https://duffel.com/docs/api/offer-requests)

Map `id`, `total_amount`, `total_currency`, `expires_at`, `payment_requirements.requires_instant_payment`, `conditions`, passenger IDs, and operating-carrier identity. Missing conditions mean unknown, not refundable. Hold eligibility requires an explicit `requires_instant_payment === false`; do not treat a missing field as permission to hold. List results are not authoritative for purchasing: `GET /air/offers/{id}` retrieves current details.

**Time-zone mismatch with the local model:** Duffel examples return segment `departing_at` and `arriving_at` as airport-local wall-clock strings without offsets; airports provide `time_zone`. The app's `Fare` expects timestamps with offsets. Convert using the corresponding IANA zone and travel date, including daylight saving. Never parse bare Duffel timestamps using the server's local timezone. Cover overnight and DST-boundary itineraries in fixtures.

[Offers](https://duffel.com/docs/api/offers)

## Booking, holds and recovery

`POST /air/orders` accepts exactly one `selected_offers` ID, passenger details matched to the offer passenger IDs, and `type`. Instant orders carry `payments`; hold orders omit `payments` entirely. Orders support at most nine passengers. The returned order includes `offer_id`, enabling `GET /air/orders?offer_id=…` for reconciliation. Paginate and match the intended offer and our attempt metadata; do not assume the first returned order belongs to the request.

`void_window_ends_at` is an **order** field, nullable and preview. It is not a verified offer field. Show a free-cancellation deadline only after it is actually returned; do not promise a generic 24-hour window before booking. Display the full operating-carrier name and booking reference with the itinerary.

[Orders](https://duffel.com/docs/api/v2/orders), [order listing](https://duffel.com/docs/api/orders)

Booking transport must allow at least 130 seconds. `201` carries a created resource. `200` can instead contain only a supplier-confirmed message with no resource ID; `202` means the outcome is being resolved. Never resubmit those requests. Also keep `500`, `502`, transport failure and timeout in a durable `checking` state. A `503` is documented as safe to retry because no supplier booking occurred; use a bounded retry with the same local attempt, or let the user retry that attempt. Do not generalize safe retry to all 5xx responses. Empty reconciliation results do not prove failure: creation can surface later.

The `ratelimit-reset` header is an HTTP-date, e.g. `Tue, 24 Nov 2020 08:22:00 GMT`, not a Unix timestamp. Read `ratelimit-limit` and `ratelimit-remaining` too; do not hardcode the documentation's example quota as the organisation's actual allowance.

[Response handling](https://duffel.com/docs/api/overview/response-handling)

For holds, persist `payment_status.payment_required_by`, `price_guarantee_expires_at`, `awaiting_payment`, and `paid_at`. An expired unpaid hold may have `awaiting_payment=false`, so that flag alone does **not** mean paid. Retrieve the order again before payment; price or schedule changes require review. [Hold guide](https://duffel.com/docs/guides/holding-orders-and-paying-later)

`POST /air/payments` pays a hold using its current `order_id`, `amount`, `currency`, and payment type. A payment may be `pending`, `failed`, `succeeded`, or `cancelled`; do not declare success from HTTP success alone. A payment `500` may already have charged the airline, so reconcile before retrying. `GET /air/payments?order_id=…` is available. The payment docs say the test balance is unlimited, correcting the roadmap's possible test top-up instruction. [Payments](https://duffel.com/docs/api/payments)

## Webhooks

`X-Duffel-Signature` has `t=<timestamp>,v1=<lowercase hex digest>`. Sign the exact bytes `timestamp + "." + rawBody` using HMAC-SHA256. The webhook secret is used as the literal secret bytes; do **not** base64-decode it merely because its text looks base64 encoded. Decode the hex digest, enforce equal lengths, and use constant-time comparison. Verify before JSON parsing. A bounded timestamp tolerance is an additional application replay defense; choose and test the tolerance explicitly. [Receiving webhooks](https://duffel.com/docs/guides/receiving-webhooks)

Delivery is at least once and not ordered. Persist deduplication and the state change in one transaction, using provider + event type + idempotency key (and retaining event ID). Do not deduplicate different event types solely by order ID. Relevant events include `order.created`, `order.airline_initiated_change_detected` and `stays.booking.created`. Verify `live_mode` matches the deployment. A test webhook receives test events only. [Webhooks](https://duffel.com/docs/api/webhooks)

Application rule: terminal or later booking states must not regress when older events arrive. Only match a webhook to an existing locally authorized booking attempt; do not accept case IDs or ownership from its metadata as authorization.

## Stays

The required sequence is search → retrieve complete rates for a result → quote a rate → book a quote. Search results alone are not bookable inventory. Preserve `search_result_id`, `rate_id`, and `quote_id` as separate IDs. [Getting started with Stays](https://duffel.com/docs/guides/getting-started-with-stays)

`POST /stays/search` accepts `rooms`, guests, check-in/out dates and either accommodation IDs or `location: { radius, geographic_coordinates: { latitude, longitude } }`. Location radius is kilometres. Check-in can be at most 330 days ahead; stays are at most 99 nights. Search results may have incomplete room/rate detail. Preserve `cheapest_rate_due_at_accommodation_amount` and its currency separately from the displayed room total. [Stay search](https://duffel.com/docs/api/v2/search)

`POST /stays/quotes` takes `{ data: { rate_id } }`; `GET /stays/quotes/{id}` retrieves it. Quoting checks current availability and price. `due_at_accommodation_amount` can be null (unknown) and must not become zero. Preserve its currency even if it differs from the quote total currency. [Quotes](https://duffel.com/docs/api/v2/quotes/create-quote)

`POST /stays/bookings` uses `quote_id`, lead contact details and guests. Balance payments omit `payment`. Metadata can hold a non-sensitive local attempt ID. Booking list documentation exposes pagination and `user_id`, but **no verified `quote_id` query filter**. Prefer `stays.booking.created`, which the response-handling guide says carries the quote/booking correlation, or paginate and match verified metadata. Never invent a query filter and assume an empty response permits retry. [Stay bookings](https://duffel.com/docs/api/v2/bookings/get-booking)

Verified in the installed SDK 4.31.0 types on 2026-11-03: `StaysAmenity.type` includes `accessibility_mobility`; `StaysBookingPayload` has `accommodation_special_requests` (not generic `special_requests`). The adapter uses those exact fields. Unknown accessibility fails the required-access filter; an amenity flag still needs property confirmation. The 1–100 km radius is an application constraint. Real-account fixtures/access and end-to-end provider verification remain open.

## Email and production pooling

Resend supports `POST https://api.resend.com/emails` with bearer auth and `{ from, to, subject, text/html }`. Use an authenticated sender on the verified domain. Production magic-link delivery should fail clearly if the sender/key is unavailable; never print production links. Email digests should contain a count and an authenticated app link, without patient names, diagnoses, story text, routes or tokens. [Send email](https://resend.com/docs/api-reference/emails/send-email)

Send a stable `Idempotency-Key` header for each caregiver/day digest. Resend retains idempotency keys for 24 hours and permits keys up to 256 characters. A database digest record still provides longer deduplication. Reuse the same payload on retries of one key. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

Call `attachDatabasePool(pool)` from `@vercel/functions` immediately after constructing the shared `pg.Pool` for Fluid compute. It manages idle connections around function suspension; it does not replace transaction management or prove Neon pooler compatibility. Release clients in `finally` and keep the pool process-global. [Vercel pool reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)

## Implementation and verification boundary

- Inject fetch/clock/provider dependencies so all status, timeout, signature, replay and price-change cases run without live accounts.
- A local attempt claim must be atomic and unique before network I/O; correlation headers alone cannot prevent double booking. Persist pending work before calling the provider, then resolve the same row after the call.
- Claims, snapshot selection and watch reads are scoped to the authenticated owner. Use a system actor only for authenticated jobs/webhooks, never a client-supplied actor.
- Configure live mode explicitly and fail closed until the owner supplies production approvals/accounts. Missing configured-provider credentials should produce a setup error, not silently label mocked results as real.
- Fixture tests can validate the implementation contract. They cannot prove carrier access, live quota, sender-domain configuration, Neon pooling, external immutable anchoring, or production legal readiness.
