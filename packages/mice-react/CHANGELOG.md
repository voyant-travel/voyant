# @voyant-travel/mice-react

## 0.15.0

### Patch Changes

- @voyant-travel/admin@0.118.0
- @voyant-travel/relationships-react@0.147.0

## 0.14.0

### Patch Changes

- Updated dependencies [ecdf0fc]
  - @voyant-travel/admin@0.117.0
  - @voyant-travel/relationships-react@0.146.0

## 0.13.0

### Patch Changes

- @voyant-travel/mice@0.6.8
- @voyant-travel/relationships-react@0.145.0

## 0.12.0

### Patch Changes

- @voyant-travel/mice@0.6.7
- @voyant-travel/relationships-react@0.144.0

## 0.11.0

### Patch Changes

- Updated dependencies [425f92e]
  - @voyant-travel/utils@0.106.0
  - @voyant-travel/relationships-react@0.143.0
  - @voyant-travel/ui@0.108.11
  - @voyant-travel/mice@0.6.6
  - @voyant-travel/types@0.107.1

## 0.10.0

### Patch Changes

- @voyant-travel/relationships-react@0.142.0

## 0.9.0

### Patch Changes

- @voyant-travel/relationships-react@0.141.0

## 0.8.0

### Patch Changes

- Updated dependencies [62e87ee]
  - @voyant-travel/admin@0.116.0
  - @voyant-travel/i18n@0.110.0
  - @voyant-travel/relationships-react@0.140.0

## 0.7.0

### Patch Changes

- 53a90b1: Render an em dash in the MICE agenda Time column when a session has no start time instead of repeating the day date.
- 2453207: Use the relationships person combobox when adding MICE delegates instead of asking admins for raw person IDs.
- 0ecded6: Expose MICE rooming assignment and booking linkage workflows on the program detail UI.
- Updated dependencies [c9a356f]
- Updated dependencies [2453207]
- Updated dependencies [922d0fd]
- Updated dependencies [f000bb3]
- Updated dependencies [28c59ea]
- Updated dependencies [2613dfb]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/mice@0.6.5
  - @voyant-travel/relationships-react@0.139.0
  - @voyant-travel/admin@0.115.4
  - @voyant-travel/utils@0.105.6

## 0.6.0

### Minor Changes

- ed31e95: MICE Programs — create and edit a program (the list was previously a dead end).

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

### Patch Changes

- Updated dependencies [ed31e95]
  - @voyant-travel/mice@0.6.0

## 0.5.1

### Patch Changes

- fbab921: MICE admin surfaces — consistency polish across the program views.

  - `ProgramsPage` and `ProgramSessionsSection` now request the backend's max
    page and show a "Showing the first N" notice when capped, matching the
    delegates and RFP surfaces (no silent truncation). The Programs admin SSR
    loader limit is bumped to match the page so its prefetch still hits the
    query key.
  - The create-session and add-delegate dialogs reset their form on every close
    (cancel/escape), matching the enroll/RFP dialogs — a cancelled draft no
    longer reappears on reopen.

## 0.5.0

### Minor Changes

- dc6c26d: MICE Programs **Sourcing** surface — RFP → bid → award on the program detail
  page (the final RFC voyant#1489 Phase 4 surface).

  - `ProgramRfpsSection` (`./ui`): lists a program's RFPs (title, status, due)
    and creates new ones in place. "Manage" opens the sourcing funnel for one
    RFP — invite suppliers, record bids, and award to a winning bid — rendered
    inside `ProgramDetailPage`. Only operator-settable statuses are offered;
    `awarded` / `accepted` / `rejected` are reached solely through the award flow.
  - `useRfp` (RFP detail with embedded invitations + bids) and `useRfpMutation`
    (create RFP / invite / record bid / award), with schemas
    `rfpSingleResponse`, `rfpDetailResponse`, `bidSingleResponse`,
    `invitationSingleResponse`, and `awardResponse`. Funnel mutations invalidate
    both the RFP list and the RFP detail so the manage view refreshes in place.

## 0.4.0

### Minor Changes

- 31a2f27: MICE Programs **Delegates** surface — roster + session enrollment on the
  program detail page.

  - `ProgramDelegatesSection` (`./ui`): lists a program's delegates (role,
    status), adds new ones in place (role, status, optional person), and enrolls
    a delegate into one of the program's agenda sessions — rendered inside
    `ProgramDetailPage` below the Agenda. The roster requests the backend's max
    page (500) and says so when a program hits the cap rather than silently
    dropping delegates.
  - `useDelegateMutation` hook (create / update / enroll) invalidating the
    delegates list root; `delegateSingleResponse` + `enrollmentRecordSchema`
    schemas for the POST/PATCH/enroll responses.

- e585844: MICE Programs **Agenda** surface — sessions on the program detail page.

  - `ProgramSessionsSection` (`./ui`): lists a program's agenda sessions and
    creates new ones in place (title, type, day, track, capacity, registration),
    rendered inside `ProgramDetailPage` below the cost sheet. Sessions are a
    program's agenda, not a top-level surface, so they nest in the detail.
  - `useSessionMutation` hook (create + update) invalidating the owning program's
    session list, plus the `sessionSingleResponse` schema for the POST/PATCH
    responses.

## 0.3.0

### Minor Changes

- 7cb6fa7: Package-delivered MICE admin surface (`@voyant-travel/mice-react/admin`).

  - New `./admin` entry exporting `createMiceAdminExtension` — contributes the
    Programs nav item (spliced after Bookings) plus the route implementations for
    the programs list (`/mice`) and a program's detail (`/mice/$id`, where the
    per-currency cost sheet lives). Picked up by `voyant admin generate` via the
    `<module>-react/admin` convention; resolves the `mice.program.list` /
    `mice.program.detail` semantic destinations.
  - `@voyant-travel/i18n`: new `nav.mice` operator-admin label (en "Programs",
    ro "Programe").

### Patch Changes

- Updated dependencies [7cb6fa7]
  - @voyant-travel/i18n@0.109.0
  - @voyant-travel/admin@0.115.2
  - @voyant-travel/ui@0.108.2

## 0.2.0

### Minor Changes

- af9b46e: New `@voyant-travel/mice-react` package — the React data layer + hooks for the
  MICE admin API, plus the Programs UI.

  - Typed client/schemas/query-keys/query-options + `@tanstack/react-query` hooks
    for all MICE surfaces: programs (+ cost sheet), sessions, delegates, rooming,
    RFPs (`usePrograms`, `useProgram`, `useProgramCostSheet`, `useProgramMutation`,
    `useProgramSessions`, `useProgramDelegates`, `useProgramRooming`,
    `useProgramRfps`).
  - Programs UI components (`./ui`): `ProgramsPage` (list), `ProgramDetailPage`,
    and `ProgramCostSheetPanel` — the P&L renders **per currency** (no FX),
    matching the cost-sheet service.

  Follow-ups: the `./admin` extension + operator admin-generate wiring, en/ro
  i18n, and the remaining admin surfaces (sessions, delegates, rooming, RFP/bids).
