import {
  type ReportDraft,
  type ReportWidgetDefinition,
  reportDraftSchema,
} from "@voyant-travel/reporting-contracts"
import { describe, expect, it } from "vitest"

import {
  addCustomInstance,
  addPresetInstance,
  applyItemsToDraft,
  createInstanceId,
  instanceLayoutFromItem,
  layoutItemFromInstance,
  type ReportingCatalog,
  removeInstance,
  resolveDraft,
  setCustomInstanceDefinition,
  setInstanceTitle,
} from "./report-document.js"

const widgetDefinition = (
  id: string,
  over: Partial<ReportWidgetDefinition> = {},
): ReportWidgetDefinition => ({
  id,
  version: 1,
  label: id,
  query: {
    dataset: { id: "bookings" },
    select: [{ kind: "aggregate", operation: "count", as: "total" }],
    filters: [],
    groupBy: [],
    orderBy: [],
  },
  visualization: { type: "kpi", options: {} },
  defaultSize: { width: 3, height: 2 },
  ...over,
})

const catalog: ReportingCatalog = {
  datasets: [],
  widgets: [widgetDefinition("bookings.total"), widgetDefinition("finance.trend")],
  templates: [],
}

const emptyDraft: ReportDraft = { parameters: {}, widgets: [] }

// Deterministic id sequence for tests.
function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

describe("report-document instance model", () => {
  it("distinguishes instance ids from preset/definition ids and allows repeats", () => {
    const first = addPresetInstance(emptyDraft, widgetDefinition("bookings.total"), {
      random: sequenceRandom([0]),
    })
    const second = addPresetInstance(first.draft, widgetDefinition("bookings.total"), {
      random: sequenceRandom([0.5]),
    })

    const widgets = second.draft.widgets
    expect(widgets).toHaveLength(2)
    // Both instances point at the same preset id...
    for (const widget of widgets) {
      expect(widget.source).toMatchObject({ kind: "preset", widgetId: "bookings.total" })
    }
    // ...but carry distinct instance ids.
    expect(widgets[0]?.id).not.toBe(widgets[1]?.id)
    expect(first.instanceId).not.toBe(second.instanceId)
  })

  it("places appended instances without overlap and stays contract-valid", () => {
    let draft = emptyDraft
    for (let i = 0; i < 3; i += 1) {
      draft = addPresetInstance(draft, widgetDefinition("bookings.total"), {
        random: sequenceRandom([i / 10]),
      }).draft
    }
    // A persisted full ReportDraft (sources + layout), not layout-only rectangles.
    const parsed = reportDraftSchema.safeParse(draft)
    expect(parsed.success).toBe(true)
  })

  it("resolves preset availability against the catalog and keeps custom widgets available", () => {
    const preset = addPresetInstance(emptyDraft, widgetDefinition("bookings.total")).draft
    const missing = addPresetInstance(preset, widgetDefinition("gone.widget")).draft
    const custom = addCustomInstance(missing, widgetDefinition("custom-1")).draft

    const resolved = resolveDraft(custom, catalog)
    const byPreset = resolved.map((entry) => ({
      source: entry.instance.source.kind,
      available: entry.available,
    }))
    expect(byPreset).toEqual([
      { source: "preset", available: true },
      { source: "preset", available: false },
      { source: "custom", available: true },
    ])
  })

  it("round-trips layout between the persisted instance and the grid item", () => {
    const { draft, instanceId } = addPresetInstance(emptyDraft, widgetDefinition("bookings.total"))
    const instance = draft.widgets.find((widget) => widget.id === instanceId)
    if (!instance) throw new Error("instance missing")
    const item = layoutItemFromInstance(instance)
    expect(item.widgetId).toBe(instanceId)
    expect(instanceLayoutFromItem(item)).toEqual(instance.layout)
  })

  it("applies grid items back onto instances by id and preserves unmatched", () => {
    const { draft, instanceId } = addPresetInstance(emptyDraft, widgetDefinition("bookings.total"))
    const next = applyItemsToDraft(draft, [
      { widgetId: instanceId, x: 4, y: 5, width: 6, height: 3 },
      { widgetId: "unknown", x: 0, y: 0, width: 1, height: 1 },
    ])
    expect(next.widgets[0]?.layout).toEqual({ x: 4, y: 5, width: 6, height: 3 })
    expect(next.widgets).toHaveLength(1)
  })

  it("sets and clears instance titles and swaps custom definitions", () => {
    const { draft, instanceId } = addCustomInstance(emptyDraft, widgetDefinition("custom-1"))
    const titled = setInstanceTitle(draft, instanceId, "  My widget  ")
    expect(titled.widgets[0]?.title).toBe("My widget")
    const cleared = setInstanceTitle(titled, instanceId, "   ")
    expect(cleared.widgets[0]?.title).toBeUndefined()

    const swapped = setCustomInstanceDefinition(
      draft,
      instanceId,
      widgetDefinition("custom-1", {
        label: "Updated",
        visualization: { type: "table", options: {} },
      }),
    )
    const source = swapped.widgets[0]?.source
    expect(source?.kind).toBe("custom")
    if (source?.kind === "custom") {
      expect(source.definition.visualization.type).toBe("table")
    }
  })

  it("removes an instance by id", () => {
    const { draft, instanceId } = addPresetInstance(emptyDraft, widgetDefinition("bookings.total"))
    expect(removeInstance(draft, instanceId).widgets).toHaveLength(0)
  })

  it("createInstanceId avoids collisions with existing ids", () => {
    const id = createInstanceId(["w-aaaaaaaa"], sequenceRandom([0, 0, 0, 0, 0, 0, 0, 0, 0.5]))
    expect(id).toMatch(/^w-[a-z0-9]{8}$/)
    expect(id).not.toBe("w-aaaaaaaa")
  })
})
