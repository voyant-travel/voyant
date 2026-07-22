# @voyant-travel/reporting-contracts

## 0.3.2

### Patch Changes

- Updated dependencies [a668d0d]
  - @voyant-travel/core@0.132.0

## 0.3.1

### Patch Changes

- Updated dependencies [9848276]
- Updated dependencies [dffbdad]
- Updated dependencies [f2c9404]
  - @voyant-travel/core@0.131.0

## 0.3.0

### Minor Changes

- 464815c: Report export, base-currency reporting, and a redesigned builder.

  - Add report export in CSV, XLSX, and visual PDF (charts stay charts; only table
    widgets render as tables) via a new `GET /reports/:id/export` route and a
    client-side visual PDF composer.
  - Remove report versioning (versions/runs routes, tables, and retention): the
    editable draft is the single source of truth. Reporting datasets now expose a
    `defaultDateField` so the page date window applies without a per-report knob.
  - Add a `reportCurrency=base` execution mode: Finance receivables consolidate
    every amount into the operator base currency using the recording-time FX
    snapshot (`base_*_cents`), so a report can show one cross-currency total. The
    query language gains `between` and `in (...)` operators and a typed
    `ReportDatasetQueryError`.
  - Redesign the reporting-react builder to match the admin aesthetic: page date
    window, base-currency toggle, export menu, widget-preview and configuration
    Sheets, a CodeMirror query editor for custom widgets, and a silent autosave
    with an unsaved-changes guard.
  - Fix the Bookings/Finance reporting time-grain grouping (literal `date_trunc`
    grain) that previously errored under `group by`.

## 0.2.1

### Patch Changes

- Updated dependencies [a160a81]
  - @voyant-travel/core@0.130.0

## 0.2.0

### Minor Changes

- b8b25b7: Add the composable reporting platform: module-owned semantic datasets and widget presets,
  cross-module full-page templates, persisted editable report drafts, immutable published versions,
  bounded query parsing and execution, source-scope authorization, and standard Operator selection.
  Bookings and Finance now contribute initial operational reporting content.

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/core@0.129.0
