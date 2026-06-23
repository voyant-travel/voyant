# @voyant-travel/mice-react

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
