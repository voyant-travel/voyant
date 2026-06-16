---
"@voyant-travel/finance": minor
---

New generic order-payment-session service: `createOrderPaymentSessions({ targetType })` → `{ ensureSession, fetchSessions }` (from `@voyant-travel/finance` and `./order-payment-sessions`). Owns the "find live/settled session or create one, then optionally start the provider" logic generically over a target type, so deployments don't reimplement it per order kind.
