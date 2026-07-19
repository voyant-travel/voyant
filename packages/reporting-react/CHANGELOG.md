# @voyant-travel/reporting-react

## 0.2.0

### Minor Changes

- b8b25b7: Connect the generic reporting-react grid to `@voyant-travel/reporting-contracts` and the operator admin app as a cohesive `/reporting` vertical slice: an instance-aware `ReportDraft` model (widget instance id distinct from preset/definition id, full-draft persistence), a revision-guarded autosave document controller with optimistic-conflict resolution, the `/reporting` admin extension (list, create, instantiate-template, open; view/edit toggle; preset + custom-widget catalog; grid editing), a bounded custom-widget query editor over `/queries/parse` and `/queries/preview`, and generic KPI/table/line/bar/pie renderers. The `@voyant-travel/reporting` manifest now declares an admin runtime pointing at `@voyant-travel/reporting-react/admin`, and Reporting is selected in operator-standard.
- b8b25b7: Add the React reporting builder vertical slice (`@voyant-travel/reporting-react`)
  with explicit view and edit modes. View renders only available widgets with no
  authoring handles; edit adds a widget catalog, a 12-column constrained grid, and
  a configuration inspector with drag-by-header, resize, and add/remove.
  Unavailable widgets appear only in edit mode as removable placeholders. Layout
  is stored library-neutrally and driven through a Voyant-owned wrapper over
  `react-grid-layout`, with a deterministic single-column narrow projection, a
  keyboard-accessible move/resize fallback, reduced-motion support, and an
  optimistic local draft with debounced autosave through a typed persistence
  adapter.

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/reporting-contracts@0.2.0
