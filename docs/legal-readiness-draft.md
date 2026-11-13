# Bon Voyage legal and clinical readiness working draft

**Status:** internal review draft, 2026-11-11. Not approved terms, a privacy policy, medical advice, or evidence of regulatory compliance. No operating legal entity, privacy contact, clinical dispatch process, or region-specific approval has been established in this checkout. `REAL_PATIENT_DATA_ENABLED` defaults to `false`; the `jurisdiction_release` register defaults to no active countries.

## Review and activation register

For each residence country or territory, counsel and the named operator must record: legal entity and privacy contact; applicable privacy and consumer-health rules; whether a HIPAA-regulated relationship exists; age and caregiver rules; language; purpose and legal basis for health intake; notice and consent version; retention and deletion periods; cross-border transfer basis; vendor agreements and sub-processors; clinical escalation and emergency guidance; incident owner; effective and review dates. Only then may an operator insert a time-limited, audited `jurisdiction_release` row and separately set `REAL_PATIENT_DATA_ENABLED=true`. A release expires automatically. Worldwide browsing does not imply intake eligibility or clinic availability.

## Privacy notice draft topics

- Identify the legal entity, contact, regions served, data controller/processor roles, and the exact product purpose.
- Describe account data (verified email, encrypted profile, sessions and passkeys), optional care data, planning data, audit and security records, and provider communications separately.
- State collection sources, uses, access roles, service providers, storage locations, transfers, retention periods, rights, complaint paths, and breach contact. Include local law variations.
- Describe automated assistance and its limits; do not imply clinical review where none occurred.
- No advertising uses or sale of health information without separate analysis and approval.

## Terms and medical limitations draft topics

- Define whether Bon Voyage is an information and planning service, an agency, or a healthcare provider in each market. Identify the contracting entity and dispute process.
- Separate sample pricing and travel search from verified offers, provider confirmations, bookings, payments, cancellation terms, and insurance.
- State that dates are preferences; no appointment, recovery period, fitness to fly, outcome, or treatment eligibility is established by the app.
- Provide emergency instructions appropriate to each served region. Do not use the app for urgent symptoms.
- Include accessibility, accuracy corrections, and changes to service terms.

## Consent and adult declaration

Current code stores an adult declaration in the encrypted profile. For an activated country, health intake requires verified email, adult declaration, a current region policy version, and a purpose-specific consent receipt. Withdrawal is recorded. Counsel must approve the exact notice text, affirmative UI, parental/guardian exclusions, and withdrawal consequences before activation. Account creation alone is not health-data consent.

## Retention and data requests

Publish a record-type schedule only after counsel determines periods for account, session, passkey, clinical, planning, booking, consent, support, security, and audit data. The My data page currently records access/correction/deletion requests but has no staffed fulfillment workflow. The export endpoint is a **planning-data subset**, not a comprehensive statutory export. Assign an owner, response clock, identity-verification process, exception handling, and deletion/anonymization process before real use.

## Incident response and vendor processing

Name the incident commander and backups; document triage, containment, evidence preservation, affected-system isolation, notification analysis by jurisdiction, deadlines, and patient/support communication. Inventory email, hosting, database, AI, travel, analytics, audit-anchor, and support vendors; record data flow, location, contracts, transfer mechanisms, sub-processors, security controls, and offboarding. Test restores and encryption-key rotation in a separate environment. Maintain immutable audit copies outside the application database.

## Release checklist

Counsel-approved regional policies; named legal entity/privacy contact; working email delivery; provider and transfer agreements; external security review; incident owner; tested backups/restore and key rotation; clinical safety process; staffed data-rights workflow; verified clinic and price provenance; explicit operator activation. Code changes alone do not establish HIPAA, GDPR, WCAG, or other certification.
