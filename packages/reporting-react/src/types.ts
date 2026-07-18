import type { ReactNode } from "react"

/**
 * The canonical reporting grid is always authored against 12 columns. Narrow
 * viewports render a deterministic single-column projection of the same model
 * (see {@link ./layout/grid-model.ts}). Persisted layouts are always stored in
 * the canonical 12-column space so they round-trip across viewports.
 */
export const CANONICAL_COLUMNS = 12

/** Number of columns used when a viewport is too narrow for the 2D grid. */
export const NARROW_COLUMNS = 1

/**
 * A library-neutral placement of a widget on the reporting grid.
 *
 * This shape is intentionally decoupled from `react-grid-layout` (which uses
 * `{ i, x, y, w, h }`). The Voyant grid wrapper is the only place that
 * translates to/from the underlying library, so consumers and persistence only
 * ever see this shape.
 */
export interface LayoutItem {
  /** Stable identity of the widget instance placed on the grid. */
  readonly widgetId: string
  /** Column offset from the left edge, `0 <= x <= columns - width`. */
  readonly x: number
  /** Row offset from the top, `y >= 0`. */
  readonly y: number
  /** Width in columns, `1 <= width <= columns`. */
  readonly width: number
  /** Height in rows, `height >= 1`. */
  readonly height: number
}

/** A serialisable report layout. Stored in canonical 12-column space. */
export interface ReportLayout {
  readonly items: readonly LayoutItem[]
}

/** Editor modes. `view` is read-only; `edit` exposes authoring affordances. */
export type ReportMode = "view" | "edit"

export interface WidgetSize {
  readonly width: number
  readonly height: number
}

export interface WidgetRenderContext {
  readonly mode: ReportMode
  readonly item: LayoutItem
}

export interface WidgetConfigContext {
  readonly item: LayoutItem
  /** Persist a configuration change for this widget instance. */
  readonly onChange: (item: LayoutItem) => void
}

/**
 * Describes a widget that is *available* in the current environment. Only
 * widgets with a definition can be rendered; a layout item whose `widgetId` has
 * no matching definition is treated as unavailable (rendered as a removable
 * placeholder in edit mode, omitted entirely in view mode).
 */
export interface WidgetDefinition {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly category?: string
  readonly defaultSize: WidgetSize
  readonly minSize?: WidgetSize
  readonly maxSize?: WidgetSize
  readonly render: (context: WidgetRenderContext) => ReactNode
  /** Optional inspector content shown when configuring/editing the widget. */
  readonly renderConfig?: (context: WidgetConfigContext) => ReactNode
}

/** Autosave lifecycle exposed to callers and status indicators. */
export type SaveStatus = "idle" | "saving" | "saved" | "error"

/**
 * Typed persistence adapter. Persistence authority always lives on the server;
 * the draft hook keeps an optimistic local copy but never treats browser
 * storage (e.g. `localStorage`) as the source of truth.
 */
export interface ReportPersistenceAdapter {
  /** Persist the full layout. Rejected promises surface as an error status. */
  save: (layout: ReportLayout) => Promise<void>
}
