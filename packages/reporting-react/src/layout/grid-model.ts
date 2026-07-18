import { CANONICAL_COLUMNS, type LayoutItem, NARROW_COLUMNS, type WidgetSize } from "../types.js"

/**
 * Pure, library-neutral geometry for the reporting grid.
 *
 * Everything here is deterministic and side-effect free so it can be reused by
 * the drag/resize wrapper, the keyboard fallback, and the narrow-viewport
 * projection, and covered by fast unit tests without a DOM.
 */

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export interface SizeConstraints {
  readonly minSize?: WidgetSize
  readonly maxSize?: WidgetSize
}

/**
 * Clamp a single item into a valid position within `columns`, honouring the
 * widget's own min/max size constraints. Coordinates are rounded to the grid so
 * fractional values coming from a pointer drag settle onto whole cells.
 */
export function normalizeItem(
  item: LayoutItem,
  columns: number = CANONICAL_COLUMNS,
  constraints: SizeConstraints = {},
): LayoutItem {
  const maxWidth = clamp(constraints.maxSize?.width ?? columns, 1, columns)
  const minWidth = clamp(constraints.minSize?.width ?? 1, 1, maxWidth)
  const width = clamp(Math.round(item.width), minWidth, maxWidth)

  const minHeight = Math.max(1, Math.round(constraints.minSize?.height ?? 1))
  const rawMaxHeight = constraints.maxSize?.height
  const maxHeight =
    rawMaxHeight === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(minHeight, Math.round(rawMaxHeight))
  const height = clamp(Math.round(item.height), minHeight, maxHeight)

  const x = clamp(Math.round(item.x), 0, columns - width)
  const y = Math.max(0, Math.round(item.y))

  return { widgetId: item.widgetId, x, y, width, height }
}

/** Normalize every item in a layout independently. */
export function normalizeLayout(
  items: readonly LayoutItem[],
  columns: number = CANONICAL_COLUMNS,
  constraintsByWidget: Readonly<Record<string, SizeConstraints>> = {},
): LayoutItem[] {
  return items.map((item) => normalizeItem(item, columns, constraintsByWidget[item.widgetId] ?? {}))
}

/** True when two items overlap on the 2D grid. */
export function itemsOverlap(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * Deterministic reading order: top-to-bottom, then left-to-right, with the
 * widget id as a final tiebreaker so the order never depends on array identity.
 */
export function sortReadingOrder(items: readonly LayoutItem[]): LayoutItem[] {
  return [...items].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    if (a.x !== b.x) return a.x - b.x
    return a.widgetId < b.widgetId ? -1 : a.widgetId > b.widgetId ? 1 : 0
  })
}

/**
 * Find the lowest free `y` at which `candidate` fits in `columns` without
 * overlapping any `placed` item. Used to append new widgets deterministically.
 */
export function findVacantPosition(
  placed: readonly LayoutItem[],
  size: WidgetSize,
  columns: number = CANONICAL_COLUMNS,
): { x: number; y: number } {
  const width = clamp(Math.round(size.width), 1, columns)
  const height = Math.max(1, Math.round(size.height))
  const maxX = columns - width

  for (let y = 0; ; y++) {
    for (let x = 0; x <= maxX; x++) {
      const probe: LayoutItem = { widgetId: "__probe__", x, y, width, height }
      if (!placed.some((other) => itemsOverlap(probe, other))) {
        return { x, y }
      }
    }
  }
}

/** Append an item at the first vacant slot, returning a new layout. */
export function addItem(
  items: readonly LayoutItem[],
  widgetId: string,
  size: WidgetSize,
  columns: number = CANONICAL_COLUMNS,
): LayoutItem[] {
  const width = clamp(Math.round(size.width), 1, columns)
  const height = Math.max(1, Math.round(size.height))
  const { x, y } = findVacantPosition(items, { width, height }, columns)
  return [...items, { widgetId, x, y, width, height }]
}

/** Remove an item by widget id, returning a new layout. */
export function removeItem(items: readonly LayoutItem[], widgetId: string): LayoutItem[] {
  return items.filter((item) => item.widgetId !== widgetId)
}

/** Replace a single item in place (by widget id), returning a new layout. */
export function updateItem(items: readonly LayoutItem[], next: LayoutItem): LayoutItem[] {
  return items.map((item) => (item.widgetId === next.widgetId ? next : item))
}

/**
 * Keyboard/programmatic move by a whole-cell delta. The result is clamped into
 * the grid; this is the accessible fallback for pointer dragging.
 */
export function moveItem(
  items: readonly LayoutItem[],
  widgetId: string,
  delta: { dx: number; dy: number },
  columns: number = CANONICAL_COLUMNS,
  constraints: SizeConstraints = {},
): LayoutItem[] {
  const target = items.find((item) => item.widgetId === widgetId)
  if (!target) return [...items]
  const moved = normalizeItem(
    { ...target, x: target.x + delta.dx, y: target.y + delta.dy },
    columns,
    constraints,
  )
  return updateItem(items, moved)
}

/**
 * Keyboard/programmatic resize by a whole-cell delta. The result is clamped to
 * the grid and to the widget's size constraints; the accessible fallback for
 * pointer resizing.
 */
export function resizeItem(
  items: readonly LayoutItem[],
  widgetId: string,
  delta: { dWidth: number; dHeight: number },
  columns: number = CANONICAL_COLUMNS,
  constraints: SizeConstraints = {},
): LayoutItem[] {
  const target = items.find((item) => item.widgetId === widgetId)
  if (!target) return [...items]
  const resized = normalizeItem(
    {
      ...target,
      width: target.width + delta.dWidth,
      height: target.height + delta.dHeight,
    },
    columns,
    constraints,
  )
  return updateItem(items, resized)
}

/**
 * Deterministic narrow-viewport projection: stack every item full-width in
 * reading order. The same canonical model therefore renders predictably on a
 * phone without a second stored layout.
 */
export function projectToNarrow(
  items: readonly LayoutItem[],
  narrowColumns: number = NARROW_COLUMNS,
): LayoutItem[] {
  const width = Math.max(1, narrowColumns)
  let cursor = 0
  return sortReadingOrder(items).map((item) => {
    const placed: LayoutItem = {
      widgetId: item.widgetId,
      x: 0,
      y: cursor,
      width,
      height: item.height,
    }
    cursor += item.height
    return placed
  })
}
