---
"@voyant-travel/trips": patch
"@voyant-travel/quotes": patch
---

Make public proposal acceptance reservation-safe for sourced catalog components.

- `reserveTrip` now atomically claims the envelope (`priced` → `reserve_in_progress`) before any provider dispatch, so concurrent reserves are serialized and only one caller can create upstream supplier holds. A lost claim returns a `reservation_in_progress` conflict without dispatching, and the claim is released back to `priced` if preflight rejects or throws.
- Public proposal accept is split into prepare (under the quote-accept lock) → reserve (outside any transaction) → finalize (under the lock). Sourced catalog components are no longer rejected, and a reservation is released via `cancelComponents` if final CRM acceptance loses a race (guarding idempotent replays).
