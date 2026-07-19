# @voyant-travel/reporting

## 0.2.0

### Minor Changes

- b8b25b7: Add the composable reporting platform: module-owned semantic datasets and widget presets,
  cross-module full-page templates, persisted editable report drafts, immutable published versions,
  bounded query parsing and execution, source-scope authorization, and standard Operator selection.
  Bookings and Finance now contribute initial operational reporting content.
- b8b25b7: Connect the generic reporting-react grid to `@voyant-travel/reporting-contracts` and the operator admin app as a cohesive `/reporting` vertical slice: an instance-aware `ReportDraft` model (widget instance id distinct from preset/definition id, full-draft persistence), a revision-guarded autosave document controller with optimistic-conflict resolution, the `/reporting` admin extension (list, create, instantiate-template, open; view/edit toggle; preset + custom-widget catalog; grid editing), a bounded custom-widget query editor over `/queries/parse` and `/queries/preview`, and generic KPI/table/line/bar/pie renderers. The `@voyant-travel/reporting` manifest now declares an admin runtime pointing at `@voyant-travel/reporting-react/admin`, and Reporting is selected in operator-standard.

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/core@0.129.0
  - @voyant-travel/reporting-contracts@0.2.0
  - @voyant-travel/db@0.114.15
  - @voyant-travel/hono@0.130.1
