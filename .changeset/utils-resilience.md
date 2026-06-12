---
"@voyantjs/utils": minor
---

New `@voyantjs/utils/resilience` (RFC #1687 Phase 3.3): `resilientFetch(input, init?, options?)` — per-attempt timeout (default 10s), capped exponential retries with full jitter (default 3 attempts on network errors/timeouts/429/5xx, idempotent methods only unless `retryNonIdempotent`), and an optional per-isolate circuit breaker (`createCircuitBreaker`, `CircuitOpenError`). Outbound calls burn the request's platform-enforced CPU/subrequest budget — a slow third-party now fails fast instead of hanging, and a down one trips the breaker instead of being hammered.
