---
"@voyantjs/plugin-sanity-cms": patch
---

Sanity client calls now go through `resilientFetch` (RFC #1687 Phase 3.3): 10s per-attempt timeout, capped jittered retries (3 attempts on network errors/timeouts/429/5xx) and a per-client circuit breaker that fails fast with `CircuitOpenError` after repeated upstream failures. All calls retry — including POST mutations — because they are idempotent by construction (mutations keyed by `_id`/`voyantId`). Behavior change: calls against a hung CMS now fail after ~10s per attempt instead of hanging for the platform ceiling; subscribers remain fire-and-forget (errors are caught and logged). The final failing response is still surfaced to error mapping (status + body preserved). Tune via the new `resilience` client/plugin option (`timeoutMs`, `retry`, `breaker`).
