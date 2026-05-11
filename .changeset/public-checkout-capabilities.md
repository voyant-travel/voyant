---
"@voyantjs/hono": minor
"@voyantjs/bookings": minor
"@voyantjs/finance": minor
---

Harden public checkout sessions with scoped signed capabilities. Public booking-session creation now returns a short-lived checkout capability and sets an HttpOnly SameSite cookie; PII-bearing session reads, session mutations, repricing/finalization, and public finance payment bootstrap/read routes require that booking-scoped capability. Public mutable checkout/payment routes also accept the shared `Idempotency-Key` retry middleware where it was missing.
