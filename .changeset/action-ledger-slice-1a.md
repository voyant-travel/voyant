---
"@voyantjs/action-ledger": patch
"@voyantjs/bookings": patch
"@voyantjs/db": patch
"@voyantjs/finance": patch
---

Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, payload/relay append support, booking PII sensitive-read ledgering, booking action capability declarations, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, and runtime schema/route mounting.
