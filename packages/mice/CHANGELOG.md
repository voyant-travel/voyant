# @voyant-travel/mice

## 0.2.0

### Minor Changes

- 924d201: Room-block allotment (Phase 1) + MICE program spine.

  - accommodations: `room_blocks` / `room_block_nights` / `room_block_pickups` with
    per-night counters, CHECK invariants, an append-only pickup ledger, and a
    transactional pickup/reversal/cutoff-release service; first
    `accommodationsHonoModule` (registered in the framework standard set) +
    `roomBlockLinkable`.
  - operations: `property` / `facility` linkable definitions.
  - mice (new): `mice_programs` umbrella + admin routes + `programLinkable`,
    mounted operator-local.
  - schema-kit: TypeID prefixes `hrbn` / `hrbp` / `prog`.

- f311826: Function spaces + capacity-by-layout (operations) and agenda sessions (mice) — Phase 2.

  - operations: `function_spaces` (venue sub-spaces, nestable via `parentSpaceId`
    for combinable rooms / exhibition booths) + `function_space_capacities`
    (per-layout headcount: theater / classroom / banquet / cabaret / boardroom /
    u_shape / reception / hollow_square); service + admin routes + `functionSpaceLinkable`.
  - mice: `mice_program_sessions` (timed, capacity-bound agenda items with
    session type + optional function-space link) + `mice_session_inclusions`
    (F&B / AV / materials / signage); service + admin routes + `sessionLinkable`.
  - schema-kit: TypeID prefixes `fnsp` / `fnsc` / `mpss` / `mssi`.

### Patch Changes

- @voyant-travel/db@0.109.1
