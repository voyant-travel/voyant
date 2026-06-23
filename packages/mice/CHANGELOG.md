# @voyant-travel/mice

## 0.5.1

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/accommodations@0.108.1
  - @voyant-travel/hono@0.116.2
  - @voyant-travel/operations@0.5.1

## 0.5.0

### Minor Changes

- 4ad1bf7: Consolidated commercials — program cost sheet / P&L (Phase 5).

  `getProgramCostSheet` aggregates the program's committed inventory into a P&L —
  room blocks (accommodations), space blocks (operations), and session inclusions
  (mice) — reporting contracted exposure (held × net), realized cost/sell (picked
  × net/sell), and program margin + margin %. No new spine tables (RFC §7): a
  read model over what Phases 1–4 already persist. Exposed at
  `GET /v1/admin/mice/programs/:id/cost-sheet`.

  Follow-ups (not blocking): master/split billing via bookingDistributionDetails.
  paymentOwner, attrition invoicing, and the mice.rfp.awarded auto-spawn workflow.

## 0.4.0

### Minor Changes

- 722455d: RFP → bid → award sourcing funnel (Phase 4).

  - mice: `mice_rfps` + `mice_rfp_invitations` + `mice_bids` + `mice_bid_lines` +
    `mice_bid_evaluations` — multi-supplier bid solicitation, comparison, and
    scoring (the gap CRM quote/opportunity didn't cover). `awardRfp` atomically
    accepts the winning bid, rejects the rest, and moves the RFP to `awarded`.
    Service + admin routes + rfp/bid linkables; supplier-FK refs handled.
  - schema-kit: TypeID prefixes mrfp/mrfi/mbid/mbln/mbev.
  - Deployment link: bid↔supplier.

  Follow-up (workflow): the `mice.rfp.awarded` subscriber that auto-spawns the
  legal contract + provisional room block + booking is operator-side automation,
  deferred to a workflow PR.

### Patch Changes

- @voyant-travel/db@0.109.4

## 0.3.0

### Minor Changes

- 06cfcf5: Delegate registry + rooming manifest + booking extension (Phase 3).

  - mice: `mice_program_delegates` (role + lifecycle status; PII stays on the
    linked CRM person/booking per §9-Q7) + `mice_delegate_session_enrollments`
    (idempotent per delegate+session); first-class rooming manifest
    (`mice_rooming_assignments` + `mice_rooming_assignment_delegates` join for
    shared rooms, §9-Q5); `booking_mice_details` HonoExtension on bookings.
    Services + admin routes + delegate/rooming linkables. FK refs validated
    up-front (4xx, not FK 500).
  - schema-kit: TypeID prefixes mpdl/mdse/mrma/mrad/bkmd.
  - Deployment links: delegate↔person, delegate↔booking, rooming↔roomBlock.

### Patch Changes

- @voyant-travel/db@0.109.3

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
