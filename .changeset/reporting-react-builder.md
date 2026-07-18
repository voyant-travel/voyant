---
"@voyant-travel/reporting-react": minor
---

Add the React reporting builder vertical slice (`@voyant-travel/reporting-react`)
with explicit view and edit modes. View renders only available widgets with no
authoring handles; edit adds a widget catalog, a 12-column constrained grid, and
a configuration inspector with drag-by-header, resize, and add/remove.
Unavailable widgets appear only in edit mode as removable placeholders. Layout
is stored library-neutrally and driven through a Voyant-owned wrapper over
`react-grid-layout`, with a deterministic single-column narrow projection, a
keyboard-accessible move/resize fallback, reduced-motion support, and an
optimistic local draft with debounced autosave through a typed persistence
adapter.
