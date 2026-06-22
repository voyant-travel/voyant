---
"@voyant-travel/accommodations": minor
---

Add `createAccommodationOwnedSearchHandler` — the owned-arm availability-search handler for the accommodation vertical (dynamic packaging, voyant#2093). It lets owned accommodation inventory participate in the catalog availability fan-out (`fanOutAvailabilitySearch`) so owned and sourced supply land in one ranked candidate list.

Mirrors the existing `createAccommodationBookingHandler` thin-shell + injected-bridge pattern: the handler owns the vertical-agnostic parts (criteria validation, `nightsBetween`, `StayMatch → AvailabilityCandidate` assembly with a deterministic composed `candidateRef` and a reserve-ready `selection`), and a caller-supplied `AccommodationSearchBridge` owns the inventory query (owned accommodations have no date-aware rate/availability table in the schema yet, and the location lookup spans the operations places/facility schema — both deployment-specific). `source` is left for the fan-out to stamp as `{ kind: "owned", module: "accommodations" }`. Exported from `@voyant-travel/accommodations/booking-engine`.
