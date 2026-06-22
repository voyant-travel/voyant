---
"@voyant-travel/operations": minor
"@voyant-travel/mice": minor
"@voyant-travel/schema-kit": minor
---

Function spaces + capacity-by-layout (operations) and agenda sessions (mice) — Phase 2.

- operations: `function_spaces` (venue sub-spaces, nestable via `parentSpaceId`
  for combinable rooms / exhibition booths) + `function_space_capacities`
  (per-layout headcount: theater / classroom / banquet / cabaret / boardroom /
  u_shape / reception / hollow_square); service + admin routes + `functionSpaceLinkable`.
- mice: `mice_program_sessions` (timed, capacity-bound agenda items with
  session type + optional function-space link) + `mice_session_inclusions`
  (F&B / AV / materials / signage); service + admin routes + `sessionLinkable`.
- schema-kit: TypeID prefixes `fnsp` / `fnsc` / `mpss` / `mssi`.
