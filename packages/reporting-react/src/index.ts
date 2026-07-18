// Public surface for the reporting builder vertical slice.

export {
  defaultLabels,
  type ReportBuilderLabels,
  resolveLabels,
} from "./components/labels.js"
export {
  ReportBuilder,
  type ReportBuilderProps,
} from "./components/report-builder.js"
export {
  ReportCanvas,
  type ReportCanvasProps,
} from "./components/report-canvas.js"
export {
  SaveStatusIndicator,
  type SaveStatusIndicatorProps,
} from "./components/save-status-indicator.js"
export {
  UnavailableWidget,
  type UnavailableWidgetProps,
} from "./components/unavailable-widget.js"
export {
  WidgetCatalog,
  type WidgetCatalogProps,
} from "./components/widget-catalog.js"
export {
  WidgetFrame,
  type WidgetFrameProps,
} from "./components/widget-frame.js"
export {
  WidgetInspector,
  type WidgetInspectorProps,
} from "./components/widget-inspector.js"

// Grid wrapper (library-neutral seam over react-grid-layout)
export {
  DRAG_HANDLE_CLASS,
  VoyantGrid,
  type VoyantGridProps,
} from "./grid/voyant-grid.js"
export { useNarrowViewport } from "./hooks/use-narrow-viewport.js"
export { useReducedMotion } from "./hooks/use-reduced-motion.js"
// Pure layout model
export {
  addItem,
  clamp,
  findVacantPosition,
  itemsOverlap,
  moveItem,
  normalizeItem,
  normalizeLayout,
  projectToNarrow,
  removeItem,
  resizeItem,
  type SizeConstraints,
  sortReadingOrder,
  updateItem,
} from "./layout/grid-model.js"
// Persistence + hooks
export {
  DEFAULT_AUTOSAVE_DELAY_MS,
  type ReportDraftController,
  type UseReportDraftOptions,
  useReportDraft,
} from "./persistence/use-report-draft.js"
// Availability / mode selection helpers
export {
  buildRegistry,
  catalogCandidates,
  constraintsFromRegistry,
  isWidgetAvailable,
  type PartitionedItems,
  partitionItems,
  renderableItems,
  type WidgetRegistry,
} from "./report-model.js"

// Types
export {
  CANONICAL_COLUMNS,
  type LayoutItem,
  NARROW_COLUMNS,
  type ReportLayout,
  type ReportMode,
  type ReportPersistenceAdapter,
  type SaveStatus,
  type WidgetConfigContext,
  type WidgetDefinition,
  type WidgetRenderContext,
  type WidgetSize,
} from "./types.js"
