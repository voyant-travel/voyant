# @voyant-travel/mice-react

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
