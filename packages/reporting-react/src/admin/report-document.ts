import type {
  ReportDatasetDefinition,
  ReportDraft,
  ReportTemplateDefinition,
  ReportWidgetDefinition,
  ReportWidgetInstance,
} from "@voyant-travel/reporting-contracts"

import { findVacantPosition } from "../layout/grid-model.js"
import { CANONICAL_COLUMNS, type LayoutItem } from "../types.js"

/** The persisted grid-layout shape of a widget instance. */
export type ReportGridLayout = ReportWidgetInstance["layout"]

/**
 * The catalog of manifest-declared reporting building blocks, as returned by the
 * server `GET /catalog` endpoint. Deliberately a structural subset so this
 * package never depends on the server registry package.
 */
export interface ReportingCatalog {
  readonly datasets: readonly ReportDatasetDefinition[]
  readonly widgets: readonly ReportWidgetDefinition[]
  readonly templates: readonly ReportTemplateDefinition[]
}

/**
 * A single widget instance resolved against the catalog.
 *
 * The distinction the whole vertical slice hinges on: {@link instance.id} is the
 * *instance* identity (unique within a report — a report may contain many
 * instances of the same preset), while a preset's {@link ReportWidgetDefinition.id}
 * is the *definition* identity shared across reports. The grid keys everything by
 * the instance id, so multiple instances of one preset coexist without collision.
 */
export interface ResolvedReportInstance {
  readonly instance: ReportWidgetInstance
  /** Grid placement, keyed by the *instance* id (never the preset id). */
  readonly item: LayoutItem
  /** The effective widget definition (inline for custom, catalog lookup for preset). */
  readonly definition?: ReportWidgetDefinition
  /** True when the instance can be rendered in this environment. */
  readonly available: boolean
  /** Human-readable reason an instance is unavailable, for placeholder copy. */
  readonly unavailableReason?: string
}

/** The effective display title of an instance (explicit override, else the definition label). */
export function instanceTitle(
  instance: ReportWidgetInstance,
  definition?: ReportWidgetDefinition,
): string {
  return instance.title ?? definition?.label ?? instance.id
}

/** Resolve the effective widget definition for an instance (inline custom, or catalog preset). */
export function resolveInstanceDefinition(
  instance: ReportWidgetInstance,
  catalog: ReportingCatalog,
): ReportWidgetDefinition | undefined {
  if (instance.source.kind === "custom") return instance.source.definition
  return findCatalogWidget(catalog, instance.source.widgetId, instance.source.version)
}

/** Look up a catalog widget by id, honouring an explicit version or falling back to the latest. */
export function findCatalogWidget(
  catalog: ReportingCatalog,
  widgetId: string,
  version?: number,
): ReportWidgetDefinition | undefined {
  const matches = catalog.widgets.filter((widget) => widget.id === widgetId)
  if (matches.length === 0) return undefined
  if (version !== undefined) return matches.find((widget) => widget.version === version)
  return matches.reduce((latest, widget) => (widget.version > latest.version ? widget : latest))
}

/** Translate a persisted instance into the library-neutral grid item keyed by instance id. */
export function layoutItemFromInstance(instance: ReportWidgetInstance): LayoutItem {
  return {
    widgetId: instance.id,
    x: instance.layout.x,
    y: instance.layout.y,
    width: instance.layout.width,
    height: instance.layout.height,
  }
}

/** Translate a grid item back into the persisted grid-layout shape. */
export function instanceLayoutFromItem(item: LayoutItem): ReportGridLayout {
  return { x: item.x, y: item.y, width: item.width, height: item.height }
}

/** All grid items for a draft, in draft order (one per instance, keyed by instance id). */
export function draftToItems(draft: ReportDraft): LayoutItem[] {
  return draft.widgets.map(layoutItemFromInstance)
}

/**
 * Resolve every instance in a draft against the catalog. Preset instances whose
 * widget is not in the catalog are marked unavailable; custom instances are
 * always available because they carry their own definition.
 */
export function resolveDraft(
  draft: ReportDraft,
  catalog: ReportingCatalog,
): ResolvedReportInstance[] {
  return draft.widgets.map((instance) => {
    const definition = resolveInstanceDefinition(instance, catalog)
    if (!definition) {
      const presetId = instance.source.kind === "preset" ? instance.source.widgetId : instance.id
      return {
        instance,
        item: layoutItemFromInstance(instance),
        available: false,
        unavailableReason: `Widget preset "${presetId}" is not available.`,
      }
    }
    return { instance, item: layoutItemFromInstance(instance), definition, available: true }
  })
}

/**
 * Apply an updated set of grid items back onto a draft's instances (by instance
 * id). Instances not present in `items` keep their existing layout, so a view of
 * a subset of the grid never drops instances.
 */
export function applyItemsToDraft(draft: ReportDraft, items: readonly LayoutItem[]): ReportDraft {
  const byId = new Map(items.map((item) => [item.widgetId, item]))
  return {
    ...draft,
    widgets: draft.widgets.map((instance) => {
      const item = byId.get(instance.id)
      return item ? { ...instance, layout: instanceLayoutFromItem(item) } : instance
    }),
  }
}

/** Remove a widget instance from a draft by its instance id. */
export function removeInstance(draft: ReportDraft, instanceId: string): ReportDraft {
  return { ...draft, widgets: draft.widgets.filter((instance) => instance.id !== instanceId) }
}

/** Replace a single widget instance in a draft (matched by instance id). */
export function replaceInstance(draft: ReportDraft, next: ReportWidgetInstance): ReportDraft {
  return {
    ...draft,
    widgets: draft.widgets.map((instance) => (instance.id === next.id ? next : instance)),
  }
}

/** Update the display-title override of an instance (empty string clears the override). */
export function setInstanceTitle(
  draft: ReportDraft,
  instanceId: string,
  title: string,
): ReportDraft {
  const trimmed = title.trim()
  return {
    ...draft,
    widgets: draft.widgets.map((instance) => {
      if (instance.id !== instanceId) return instance
      if (trimmed.length === 0) {
        const { title: _dropped, ...rest } = instance
        return rest
      }
      return { ...instance, title: trimmed }
    }),
  }
}

/** Replace the inline definition of a custom instance (no-op for preset instances). */
export function setCustomInstanceDefinition(
  draft: ReportDraft,
  instanceId: string,
  definition: ReportWidgetDefinition,
): ReportDraft {
  return {
    ...draft,
    widgets: draft.widgets.map((instance) => {
      if (instance.id !== instanceId || instance.source.kind !== "custom") return instance
      return { ...instance, source: { kind: "custom", definition } }
    }),
  }
}

const INSTANCE_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/**
 * Generate an instance id that satisfies the reporting identifier grammar and is
 * unique within the draft. Randomness is injectable so the model stays pure and
 * unit-testable; callers in the browser pass the default.
 */
export function createInstanceId(
  existingIds: Iterable<string>,
  random: () => number = Math.random,
): string {
  const taken = new Set(existingIds)
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    let suffix = ""
    for (let index = 0; index < 8; index += 1) {
      suffix += INSTANCE_ID_ALPHABET[Math.floor(random() * INSTANCE_ID_ALPHABET.length)] ?? "0"
    }
    const candidate = `w-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
  throw new Error("Unable to allocate a unique widget instance id.")
}

/**
 * Append a new widget instance for a preset, placing it at the first vacant grid
 * slot. Returns the mutated draft plus the new instance id so the caller can
 * select it.
 */
export function addPresetInstance(
  draft: ReportDraft,
  widget: ReportWidgetDefinition,
  options: { columns?: number; random?: () => number } = {},
): { draft: ReportDraft; instanceId: string } {
  const columns = options.columns ?? CANONICAL_COLUMNS
  const id = createInstanceId(
    draft.widgets.map((instance) => instance.id),
    options.random,
  )
  const size = clampSize(widget.defaultSize, columns)
  const { x, y } = findVacantPosition(draftToItems(draft), size, columns)
  const instance: ReportWidgetInstance = {
    id,
    source: { kind: "preset", widgetId: widget.id, version: widget.version },
    layout: { x, y, width: size.width, height: size.height },
  }
  return { draft: { ...draft, widgets: [...draft.widgets, instance] }, instanceId: id }
}

/**
 * Append a new custom widget instance carrying its own inline definition, placed
 * at the first vacant grid slot.
 */
export function addCustomInstance(
  draft: ReportDraft,
  definition: ReportWidgetDefinition,
  options: { columns?: number; random?: () => number; title?: string } = {},
): { draft: ReportDraft; instanceId: string } {
  const columns = options.columns ?? CANONICAL_COLUMNS
  const id = createInstanceId(
    draft.widgets.map((instance) => instance.id),
    options.random,
  )
  const size = clampSize(definition.defaultSize, columns)
  const { x, y } = findVacantPosition(draftToItems(draft), size, columns)
  const instance: ReportWidgetInstance = {
    id,
    source: { kind: "custom", definition },
    ...(options.title ? { title: options.title } : {}),
    layout: { x, y, width: size.width, height: size.height },
  }
  return { draft: { ...draft, widgets: [...draft.widgets, instance] }, instanceId: id }
}

function clampSize(
  size: { width: number; height: number },
  columns: number,
): { width: number; height: number } {
  return {
    width: Math.min(Math.max(Math.round(size.width), 1), columns),
    height: Math.max(Math.round(size.height), 1),
  }
}
