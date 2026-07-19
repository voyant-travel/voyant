import type { SizeConstraints } from "./layout/grid-model.js"
import type { LayoutItem, ReportMode, WidgetDefinition } from "./types.js"

/** Index available widget definitions by id for O(1) availability lookups. */
export type WidgetRegistry = ReadonlyMap<string, WidgetDefinition>

export function buildRegistry(widgets: readonly WidgetDefinition[]): WidgetRegistry {
  return new Map(widgets.map((widget) => [widget.id, widget]))
}

/** A widget is available iff a definition is registered for its id. */
export function isWidgetAvailable(widgetId: string, registry: WidgetRegistry): boolean {
  return registry.has(widgetId)
}

export interface PartitionedItems {
  /** Items whose widget definition is available in this environment. */
  readonly available: LayoutItem[]
  /** Items referencing a widget that is not currently available. */
  readonly unavailable: LayoutItem[]
}

export function partitionItems(
  items: readonly LayoutItem[],
  registry: WidgetRegistry,
): PartitionedItems {
  const available: LayoutItem[] = []
  const unavailable: LayoutItem[] = []
  for (const item of items) {
    if (registry.has(item.widgetId)) available.push(item)
    else unavailable.push(item)
  }
  return { available, unavailable }
}

/**
 * The items that should actually be laid out on the grid for a given mode.
 *
 * - `view` renders only available widgets; unavailable items are omitted so a
 *   published report never shows placeholders or gaps a reader cannot act on.
 * - `edit` renders everything so an author can see and remove the placeholder
 *   for a widget that is no longer available.
 */
export function renderableItems(
  items: readonly LayoutItem[],
  registry: WidgetRegistry,
  mode: ReportMode,
): LayoutItem[] {
  if (mode === "edit") return [...items]
  return items.filter((item) => registry.has(item.widgetId))
}

/** Collect size constraints per widget id for the grid model/normalization. */
export function constraintsFromRegistry(registry: WidgetRegistry): Record<string, SizeConstraints> {
  const out: Record<string, SizeConstraints> = {}
  for (const [id, definition] of registry) {
    if (definition.minSize || definition.maxSize) {
      out[id] = { minSize: definition.minSize, maxSize: definition.maxSize }
    }
  }
  return out
}

/**
 * Widgets not yet placed on the layout — the "add" candidates for the catalog.
 * Re-exported from the package root for convenience.
 */
export function catalogCandidates(
  widgets: readonly WidgetDefinition[],
  items: readonly LayoutItem[],
): WidgetDefinition[] {
  const placed = new Set(items.map((item) => item.widgetId))
  return widgets.filter((widget) => !placed.has(widget.id))
}
