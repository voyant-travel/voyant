---
"@voyantjs/action-ledger": patch
"@voyantjs/bookings": patch
"@voyantjs/db": patch
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/finance-ui": patch
---

Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, payload/relay append support, booking PII sensitive-read ledgering, booking action capability declarations and approval decision routing, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, and reusable finance UI action ledger cards.
