---
"@voyant-travel/mice-react": minor
---

MICE Programs — create and edit a program (the list was previously a dead end).

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
