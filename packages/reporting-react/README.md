# @voyant-travel/reporting-react

React reporting builder for operator dashboards. A vertical slice covering the
authoring UI and its supporting package surfaces — grid model, availability
logic, persistence draft loop, and accessible widget chrome.

## Modes

- **view** — renders only *available* widgets with no drag/resize/configure
  handles. Layout items whose widget is unavailable are omitted entirely.
- **edit** — adds a widget catalog, a 12-column constrained grid, and a
  configuration inspector, with drag-by-header, resize, add/remove, and a
  keyboard-accessible move/resize fallback (arrow keys move, `Shift`+arrow
  resizes). Unavailable widgets appear as removable placeholders so authors can
  clean up a layout.

## Layout model

Layouts are stored library-neutrally as `{ items: LayoutItem[] }`, where each
item is `{ widgetId, x, y, width, height }` in the **canonical 12-column**
space. `react-grid-layout` lives behind the Voyant-owned [`VoyantGrid`](./src/grid/voyant-grid.tsx)
wrapper — the only file that knows the library's `{ i, x, y, w, h }` shape.
Narrow viewports render a **deterministic single-column projection**
(`projectToNarrow`) of the same canonical model, so no second layout is stored.

`Motion` is used only for visual/layout animation (widget enter/exit fades) and
is disabled under `prefers-reduced-motion`. `react-resizable-panels` powers the
outer catalog / canvas / inspector shell only.

## Persistence

`useReportDraft(initial, adapter)` keeps an **optimistic local draft** and
debounces autosave through a typed adapter callback
(`adapter.save(layout) => Promise<void>`), exposing a `SaveStatus`
(`idle | saving | saved | error`). The server is always the source of truth —
the hook never treats `localStorage` as authoritative.

```tsx
import {
  ReportBuilder,
  type WidgetDefinition,
} from "@voyant-travel/reporting-react"
import "@voyant-travel/reporting-react/styles.css"

const widgets: WidgetDefinition[] = [
  {
    id: "revenue",
    title: "Revenue",
    defaultSize: { width: 6, height: 3 },
    render: () => <RevenueChart />,
  },
]

<ReportBuilder
  layout={layout}
  widgets={widgets}
  mode="edit"
  adapter={{ save: (l) => api.saveReportLayout(l) }}
/>
```

## Entry points

- `.` — components, model helpers, hooks, and types.
- `./grid` — the `VoyantGrid` wrapper.
- `./layout` — the pure grid model.
- `./hooks` — `useReportDraft`, `useReducedMotion`, `useNarrowViewport`.
- `./styles.css` — builder chrome plus the underlying grid styles.
