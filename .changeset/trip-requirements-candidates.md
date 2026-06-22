---
"@voyant-travel/schema-kit": minor
"@voyant-travel/trips": minor
---

Add the dynamic-packaging requirement/candidate model to Trips (voyant#2082 / voyant#1600) — keystone gap 2.

- **`@voyant-travel/trips`** — new `trip_requirements` (unresolved customer need on an envelope: vertical + criteria + criteriaVersion mirroring the catalog `AvailabilitySearchRequest`) and `trip_candidates` (a normalized `AvailabilityCandidate` attached to a requirement: rank, status, origin, decimal price, TTL, internal `providerData`) tables, with enums, relations, and migration `0001`. Service operations: `addRequirement`, `sourceRequirementCandidates` (runs a deployment-injected availability fan-out, persists the ranked set), `selectCandidate` (enforces selected-uniqueness, pins a draft catalog component the existing price/reserve pipeline re-validates), `reshopRequirement` / `reshopTrip`, and `expireStaleTripCandidates` (TTL reaper). `reserveTrip` now gates on all required requirements being resolved. The fan-out is injected (`SourceRequirementCandidatesDeps`), never a named provider.
- **`@voyant-travel/schema-kit`** — register TypeID prefixes `trrq` (trip_requirements) and `trcd` (trip_candidates).

Additive; no behavioral change to existing trip flows (an envelope with no requirements reserves exactly as before).
