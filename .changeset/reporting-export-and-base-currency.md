---
"@voyant-travel/reporting": minor
"@voyant-travel/reporting-contracts": minor
"@voyant-travel/reporting-react": minor
"@voyant-travel/finance": minor
"@voyant-travel/bookings": patch
---

Report export, base-currency reporting, and a redesigned builder.

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
