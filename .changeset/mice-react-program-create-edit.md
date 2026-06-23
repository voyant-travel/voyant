---
"@voyant-travel/mice-react": minor
"@voyant-travel/mice": minor
---

MICE Programs — create and edit a program (the list was previously a dead end).

`@voyant-travel/mice`: `updateProgramSchema` now accepts `null` on the optional
fields (destination, dates, pax, currency, budget, code, org/contact refs) so a
PATCH can **clear** them — `.partial()` alone only allowed omitting a key, which
left the previous value in place. The columns are already nullable and
`updateProgram` spreads the body into `.set()`, so no migration is needed.

`@voyant-travel/mice-react`:

- New `ProgramFormDialog` (`./ui`): a create/edit form covering name, type,
  lifecycle status, destination, dates, estimated/confirmed pax, currency, and
  budget. Pax/budget are validated as non-negative numbers; the dialog resets
  on close.
- `ProgramsPage` now always shows a **New program** button wired to the dialog,
  and lands the operator straight in the new program's detail on create — so
  the agenda / delegates / sourcing surfaces are reachable. (The button used to
  render only when the host passed an `onCreate` callback, which it never did,
  leaving the list with no way to create anything.)
- `ProgramDetailPage` gains an **Edit** action (same dialog) so the lifecycle
  status, pax, dates, and budget are operable after creation, plus a
  dates · pax meta line in the header.
