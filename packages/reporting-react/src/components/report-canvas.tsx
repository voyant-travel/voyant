import type { ReactNode } from "react"
import { VoyantGrid } from "../grid/voyant-grid.js"
import { projectToNarrow } from "../layout/grid-model.js"
import { constraintsFromRegistry, type WidgetRegistry } from "../report-model.js"
import { CANONICAL_COLUMNS, type LayoutItem, type ReportMode } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"
import { UnavailableWidget } from "./unavailable-widget.js"
import { WidgetFrame } from "./widget-frame.js"

export interface ReportCanvasProps {
  readonly items: readonly LayoutItem[]
  readonly registry: WidgetRegistry
  readonly mode: ReportMode
  readonly labels: ReportBuilderLabels
  readonly columns?: number
  readonly rowHeight?: number
  /** Render the deterministic single-column projection instead of the 2D grid. */
  readonly narrow?: boolean
  readonly animate?: boolean
  readonly selectedId?: string | null
  readonly onLayoutChange?: (items: LayoutItem[]) => void
  readonly onMove?: (widgetId: string, delta: { dx: number; dy: number }) => void
  readonly onResize?: (widgetId: string, delta: { dWidth: number; dHeight: number }) => void
  readonly onRemove?: (widgetId: string) => void
  readonly onConfigure?: (widgetId: string) => void
}

/**
 * Lays out placed widgets. Available widgets render as {@link WidgetFrame};
 * unavailable ones render as removable {@link UnavailableWidget} placeholders
 * (edit mode only — the caller is responsible for filtering them out in view
 * mode via {@link renderableItems}).
 */
export function ReportCanvas({
  items,
  registry,
  mode,
  labels,
  columns = CANONICAL_COLUMNS,
  rowHeight = 64,
  narrow = false,
  animate = true,
  selectedId = null,
  onLayoutChange,
  onMove,
  onResize,
  onRemove,
  onConfigure,
}: ReportCanvasProps) {
  const editable = mode === "edit"

  const renderItem = (item: LayoutItem): ReactNode => {
    const definition = registry.get(item.widgetId)
    if (!definition) {
      return (
        <UnavailableWidget
          item={item}
          labels={labels}
          onRemove={editable ? () => onRemove?.(item.widgetId) : undefined}
        />
      )
    }
    return (
      <WidgetFrame
        definition={definition}
        item={item}
        mode={mode}
        labels={labels}
        animate={animate}
        selected={selectedId === item.widgetId}
        onMove={editable ? (delta) => onMove?.(item.widgetId, delta) : undefined}
        onResize={editable ? (delta) => onResize?.(item.widgetId, delta) : undefined}
        onConfigure={editable ? () => onConfigure?.(item.widgetId) : undefined}
        onRemove={editable ? () => onRemove?.(item.widgetId) : undefined}
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="vrb-canvas vrb-canvas--empty">
        <p className="vrb-canvas__empty-message">{labels.emptyCanvas}</p>
      </div>
    )
  }

  if (narrow) {
    // Deterministic single-column projection: stack in reading order.
    const stacked = projectToNarrow(items)
    return (
      <div className="vrb-canvas vrb-canvas--narrow">
        {stacked.map((item) => (
          <div key={item.widgetId} className="vrb-canvas__narrow-cell">
            {renderItem(item)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="vrb-canvas">
      <VoyantGrid
        items={items}
        renderItem={renderItem}
        columns={columns}
        rowHeight={rowHeight}
        editable={editable}
        animate={animate}
        constraintsByWidget={constraintsFromRegistry(registry)}
        onLayoutChange={onLayoutChange}
      />
    </div>
  )
}
