---
"@voyantjs/plugin-netopia": patch
---

Netopia payment initiation now goes through `resilientFetch` (RFC #1687 Phase 3.3): 15s per-attempt timeout (payments get a longer ceiling than the 10s used for non-payment upstreams) and a module-level circuit breaker per Netopia base URL that fails fast with `CircuitOpenError` after repeated upstream failures. Payment starts are NEVER auto-retried — a duplicate charge is worse than a failed checkout the customer can retry — and 4xx/5xx responses are still surfaced to the existing rich error mapping (status + body preserved). Behavior change: a hung gateway now fails the checkout after ~15s instead of hanging for the platform ceiling. Tune via the new `resilience` runtime/client option (`timeoutMs`, `breaker`).
