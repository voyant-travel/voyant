import type { ReactNode } from "react"
import { useMemo } from "react"
import GridLayout, { type Layout, WidthProvider } from "react-grid-layout"
import type { SizeConstraints } from "../layout/grid-model.js"
import { CANONICAL_COLUMNS, type LayoutItem } from "../types.js"

/**
 * Voyant-owned wrapper around `react-grid-layout`.
 *
 * This is the single seam where the library-neutral {@link LayoutItem} model
 * (`{ widgetId, x, y, width, height }`) is translated to/from the library's
 * `{ i, x, y, w, h }` shape. Nothing outside this file imports
 * `react-grid-layout`, so the library can be swapped without touching the
 * builder, persistence, or the widget contract.
 */

const ResponsiveGrid = WidthProvider(GridLayout)

/** The default drag handle selector; only the widget header should drag. */
export const DRAG_HANDLE_CLASS = "vrb-widget__drag-handle"

export interface VoyantGridProps {
  readonly items: readonly LayoutItem[]
  readonly renderItem: (item: LayoutItem) => ReactNode
  readonly columns?: number
  readonly rowHeight?: number
  /** When false, drag and resize handles are disabled (view mode). */
  readonly editable?: boolean
  readonly onLayoutChange?: (items: LayoutItem[]) => void
  readonly constraintsByWidget?: Readonly<Record<string, SizeConstraints>>
  /** Suppress layout animation for reduced-motion users. */
  readonly animate?: boolean
  readonly margin?: [number, number]
  readonly containerPadding?: [number, number]
}

function toGridLayout(
  items: readonly LayoutItem[],
  constraintsByWidget: Readonly<Record<string, SizeConstraints>>,
  editable: boolean,
): Layout[] {
  return items.map((item) => {
    const constraints = constraintsByWidget[item.widgetId]
    return {
      i: item.widgetId,
      x: item.x,
      y: item.y,
      w: item.width,
      h: item.height,
      minW: constraints?.minSize?.width,
      maxW: constraints?.maxSize?.width,
      minH: constraints?.minSize?.height,
      maxH: constraints?.maxSize?.height,
      isDraggable: editable,
      isResizable: editable,
    }
  })
}

function fromGridLayout(layout: readonly Layout[]): LayoutItem[] {
  return layout.map((entry) => ({
    widgetId: entry.i,
    x: entry.x,
    y: entry.y,
    width: entry.w,
    height: entry.h,
  }))
}

export function VoyantGrid({
  items,
  renderItem,
  columns = CANONICAL_COLUMNS,
  rowHeight = 64,
  editable = false,
  onLayoutChange,
  constraintsByWidget = {},
  animate = true,
  margin = [16, 16],
  containerPadding = [0, 0],
}: VoyantGridProps) {
  const layout = useMemo(
    () => toGridLayout(items, constraintsByWidget, editable),
    [items, constraintsByWidget, editable],
  )

  return (
    <ResponsiveGrid
      className={`vrb-grid${editable ? " vrb-grid--editable" : ""}`}
      layout={layout}
      cols={columns}
      rowHeight={rowHeight}
      margin={margin}
      containerPadding={containerPadding}
      isDraggable={editable}
      isResizable={editable}
      isBounded
      draggableHandle={`.${DRAG_HANDLE_CLASS}`}
      compactType="vertical"
      useCSSTransforms={animate}
      resizeHandles={["se"]}
      onLayoutChange={(next) => onLayoutChange?.(fromGridLayout(next))}
    >
      {items.map((item) => (
        <div key={item.widgetId} className="vrb-grid__cell">
          {renderItem(item)}
        </div>
      ))}
    </ResponsiveGrid>
  )
}
