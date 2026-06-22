---
"@voyant-travel/catalog-contracts": minor
"@voyant-travel/catalog": minor
"@voyant-travel/flights": minor
---

Add the live availability-search primitive (dynamic-packaging RFC, voyant#2081 / voyant#1600) — keystone gap 1.

- **`@voyant-travel/catalog-contracts`** — new `supportsAvailabilitySearch` capability flag, the `AvailabilitySearchRequest` / `AvailabilityCandidate` / `AvailabilitySearchResult` shapes, and a capability-gated `searchAvailability` method on the `SourceAdapter` contract. `searchAvailability` searches an inventory space (destination + dates + pax → ranked candidates), as opposed to `liveResolve` which resolves volatile fields for an already-selected entity. Internal economics (net/margin/supplier ref) live under `AvailabilityCandidate.providerData` and must never appear in public DTOs.
- **`@voyant-travel/catalog`** — `fanOutAvailabilitySearch`, the vertical-agnostic counterpart of the flights fan-out: parallelizes `searchAvailability` across sourced connections and owned search handlers with a per-source timeout, partial-success status map, and a price-ranked merge. Adds an owned-availability-search-handler registry (`createOwnedAvailabilitySearchHandlerRegistry`) so owned inventory is a first-class search source alongside sourced adapters, mirroring the owned-booking-handler vs source-adapter split.
- **`@voyant-travel/flights`** — `mergedFlightOfferToCandidate` / `mergedFlightOffersToCandidates` bridge mapping the flights-native `MergedFlightOffer` onto the normalized `AvailabilityCandidate`. A mapping, not a re-implementation — flights keep their own connector contract and fan-out.

Additive only; no behavioral change to existing adapters (the new method and capability are optional). Follow-ups on voyant#2081: a concrete accommodations owned-search handler and the Voyant Connect `searchAvailability` implementation.
