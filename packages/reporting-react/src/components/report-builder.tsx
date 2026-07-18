import { useCallback, useMemo, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { useNarrowViewport } from "../hooks/use-narrow-viewport.js"
import { useReducedMotion } from "../hooks/use-reduced-motion.js"
import {
  addItem,
  moveItem,
  normalizeLayout,
  removeItem,
  resizeItem,
  updateItem,
} from "../layout/grid-model.js"
import { useReportDraft } from "../persistence/use-report-draft.js"
import {
  buildRegistry,
  catalogCandidates,
  constraintsFromRegistry,
  renderableItems,
} from "../report-model.js"
import {
  CANONICAL_COLUMNS,
  type LayoutItem,
  type ReportLayout,
  type ReportMode,
  type ReportPersistenceAdapter,
  type WidgetDefinition,
} from "../types.js"
import { type ReportBuilderLabels, resolveLabels } from "./labels.js"
import { ReportCanvas } from "./report-canvas.js"
import { SaveStatusIndicator } from "./save-status-indicator.js"
import { WidgetCatalog } from "./widget-catalog.js"
import { WidgetInspector } from "./widget-inspector.js"

export interface ReportBuilderProps {
  readonly layout: ReportLayout
  readonly widgets: readonly WidgetDefinition[]
  readonly mode: ReportMode
  readonly adapter: ReportPersistenceAdapter
  readonly columns?: number
  readonly rowHeight?: number
  readonly autosaveDelayMs?: number
  readonly narrowBreakpointPx?: number
  readonly labels?: Partial<ReportBuilderLabels>
}

/**
 * Top-level reporting builder with explicit view and edit modes.
 *
 * - `view` renders only available widgets with no authoring handles.
 * - `edit` adds the widget catalog, a 12-column constrained grid, and a
 *   configuration inspector, with drag-by-header, resize, add/remove, and a
 *   keyboard-accessible move/resize fallback.
 *
 * All layout edits flow through the pure grid model, are held as an optimistic
 * local draft, and are debounced to the typed persistence adapter — the server
 * remains the source of truth.
 */
export function ReportBuilder({
  layout,
  widgets,
  mode,
  adapter,
  columns = CANONICAL_COLUMNS,
  rowHeight = 64,
  autosaveDelayMs,
  narrowBreakpointPx = 640,
  labels: labelOverrides,
}: ReportBuilderProps) {
  const labels = useMemo(() => resolveLabels(labelOverrides), [labelOverrides])
  const registry = useMemo(() => buildRegistry(widgets), [widgets])
  const constraints = useMemo(() => constraintsFromRegistry(registry), [registry])

  const draft = useReportDraft(layout, adapter, { autosaveDelayMs })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const narrow = useNarrowViewport(narrowBreakpointPx)
  const animate = !useReducedMotion()
  const editable = mode === "edit"

  const items = draft.draft.items
  const visibleItems = useMemo(
    () => renderableItems(items, registry, mode),
    [items, registry, mode],
  )

  const commit = useCallback(
    (nextItems: LayoutItem[]) => {
      draft.setItems(normalizeLayout(nextItems, columns, constraints))
    },
    [draft, columns, constraints],
  )

  const handleLayoutChange = useCallback((nextItems: LayoutItem[]) => commit(nextItems), [commit])

  const handleMove = useCallback(
    (widgetId: string, delta: { dx: number; dy: number }) => {
      commit(moveItem(items, widgetId, delta, columns, constraints[widgetId]))
    },
    [commit, items, columns, constraints],
  )

  const handleResize = useCallback(
    (widgetId: string, delta: { dWidth: number; dHeight: number }) => {
      commit(resizeItem(items, widgetId, delta, columns, constraints[widgetId]))
    },
    [commit, items, columns, constraints],
  )

  const handleAdd = useCallback(
    (widget: WidgetDefinition) => {
      commit(addItem(items, widget.id, widget.defaultSize, columns))
      setSelectedId(widget.id)
    },
    [commit, items, columns],
  )

  const handleRemove = useCallback(
    (widgetId: string) => {
      commit(removeItem(items, widgetId))
      setSelectedId((current) => (current === widgetId ? null : current))
    },
    [commit, items],
  )

  const handleConfigChange = useCallback(
    (nextItem: LayoutItem) => commit(updateItem(items, nextItem)),
    [commit, items],
  )

  const candidates = useMemo(() => catalogCandidates(widgets, items), [widgets, items])

  const selectedItem = (selectedId && items.find((item) => item.widgetId === selectedId)) || null
  const selectedDefinition = (selectedItem && registry.get(selectedItem.widgetId)) || null

  const canvas = (
    <ReportCanvas
      items={visibleItems}
      registry={registry}
      mode={mode}
      labels={labels}
      columns={columns}
      rowHeight={rowHeight}
      narrow={narrow}
      animate={animate}
      selectedId={selectedId}
      onLayoutChange={editable ? handleLayoutChange : undefined}
      onMove={handleMove}
      onResize={handleResize}
      onRemove={handleRemove}
      onConfigure={setSelectedId}
    />
  )

  if (!editable) {
    return (
      <div className="vrb vrb--view" data-mode="view">
        {canvas}
      </div>
    )
  }

  return (
    <div className="vrb vrb--edit" data-mode="edit">
      <div className="vrb__toolbar">
        <SaveStatusIndicator
          status={draft.status}
          labels={labels}
          onRetry={() => void draft.flush()}
        />
      </div>
      <PanelGroup direction="horizontal" className="vrb__panels">
        <Panel defaultSize={22} minSize={14} className="vrb__panel">
          <WidgetCatalog candidates={candidates} labels={labels} onAdd={handleAdd} />
        </Panel>
        <PanelResizeHandle className="vrb__resize-handle" />
        <Panel defaultSize={56} minSize={30} className="vrb__panel">
          {canvas}
        </Panel>
        <PanelResizeHandle className="vrb__resize-handle" />
        <Panel defaultSize={22} minSize={14} className="vrb__panel">
          <WidgetInspector
            definition={selectedDefinition}
            item={selectedItem}
            labels={labels}
            onChange={handleConfigChange}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}
