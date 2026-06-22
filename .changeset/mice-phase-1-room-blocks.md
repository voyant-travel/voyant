---
"@voyant-travel/accommodations": minor
"@voyant-travel/framework": minor
"@voyant-travel/mice": minor
"@voyant-travel/operations": minor
"@voyant-travel/schema-kit": minor
---

Room-block allotment (Phase 1) + MICE program spine.

- accommodations: `room_blocks` / `room_block_nights` / `room_block_pickups` with
  per-night counters, CHECK invariants, an append-only pickup ledger, and a
  transactional pickup/reversal/cutoff-release service; first
  `accommodationsHonoModule` (registered in the framework standard set) +
  `roomBlockLinkable`.
- operations: `property` / `facility` linkable definitions.
- mice (new): `mice_programs` umbrella + admin routes + `programLinkable`,
  mounted operator-local.
- schema-kit: TypeID prefixes `hrbn` / `hrbp` / `prog`.
