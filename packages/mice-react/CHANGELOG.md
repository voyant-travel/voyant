# @voyant-travel/mice-react

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
