# Public cancer listing verification

No clinic is currently published. The public directory lists countries and cancer care topics, not available treatment or a provider network.

Historical fictional offers are kept in `domains/providers/archivedSampleOffers.ts` only for older private sample plans and isolated regression tests. They are not exported from the browser-safe provider catalogue. Public routes and new plan, request and travel APIs use `findPublicOffer`.

Before adding a candidate to `VERIFIED_LISTING_CANDIDATES` in `domains/providers/catalogue.ts`, a named reviewer must record and check:

1. The provider's legal identity and location against its official site or registry.
2. The relevant professional credentials against the issuing authority or registry. A general hospital accreditation does not establish every clinician's credentials.
3. The precise care option, inclusion and exclusion scope, consultation language, accessibility claim and price source. Leave any unconfirmed field unknown. Obtain permission to publish provider supplied material where needed.
4. The review date, expiration date and three HTTPS source URLs in `verification`. The source links appear on the detail page. Review them again before expiry or when the provider changes its offer.

The eligibility gate rejects sample providers, noncancer treatments, invalid countries, non-HTTPS evidence, malformed review dates and expired records. It cannot establish that a source is genuine or clinically appropriate; that remains a human review. No patient should infer appointment availability, treatment suitability, expected outcomes or fitness to fly from a listing. Travel search and care requests remain demonstrations until separate real-provider integrations and operating processes are approved.
