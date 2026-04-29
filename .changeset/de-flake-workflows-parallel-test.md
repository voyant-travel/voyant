---
"@voyantjs/workflows": patch
---

De-flake the `ctx.parallel > defaults concurrency to total items` test by asserting on elapsed time (`elapsed < SLEEP_MS * ITEMS.length`) instead of completion order. Sleep-based ordering tests are fragile under CI runner scheduler resolution; the elapsed-time invariant verifies the actual contract (real concurrency, not serialized) without relying on `setTimeout` precision.
