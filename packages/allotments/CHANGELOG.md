# @voyant-travel/allotments

## 0.2.1

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.

## 0.2.0

### Minor Changes

- 787c852: Space blocks + shared allotment-lifecycle primitive (Phase 2b).

  - New `@voyant-travel/allotments`: the canonical allotment lifecycle contract
    (status state machine, counter math, pickup-progress derivation, slot
    enumeration) — one contract reused by type-specific tables (RFC §9-Q2).
  - accommodations: room-block service refactored onto the shared primitive
    (behavior-preserving; enum values unchanged, no migration).
  - operations: `space_blocks` / `space_block_slots` / `space_block_pickups` —
    held function-space inventory over a date range, the 2nd allotment consumer;
    transactional pickup/reversal/cutoff service + admin routes + `spaceBlockLinkable`.
  - schema-kit: TypeID prefixes `spbl` / `spsl` / `sppu`.
