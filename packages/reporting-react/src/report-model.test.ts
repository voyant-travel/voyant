import { describe, expect, it } from "vitest"
import {
  buildRegistry,
  catalogCandidates,
  constraintsFromRegistry,
  isWidgetAvailable,
  partitionItems,
  renderableItems,
} from "./report-model.js"
import type { LayoutItem, WidgetDefinition } from "./types.js"

const widget = (id: string, over: Partial<WidgetDefinition> = {}): WidgetDefinition => ({
  id,
  title: id.toUpperCase(),
  defaultSize: { width: 4, height: 2 },
  render: () => null,
  ...over,
})

const place = (widgetId: string): LayoutItem => ({
  widgetId,
  x: 0,
  y: 0,
  width: 4,
  height: 2,
})

const registry = buildRegistry([widget("revenue"), widget("bookings")])

describe("isWidgetAvailable / partitionItems", () => {
  it("treats registered widgets as available and others as unavailable", () => {
    expect(isWidgetAvailable("revenue", registry)).toBe(true)
    expect(isWidgetAvailable("gone", registry)).toBe(false)

    const { available, unavailable } = partitionItems(
      [place("revenue"), place("gone"), place("bookings")],
      registry,
    )
    expect(available.map((i) => i.widgetId)).toEqual(["revenue", "bookings"])
    expect(unavailable.map((i) => i.widgetId)).toEqual(["gone"])
  })
})

describe("renderableItems", () => {
  const items = [place("revenue"), place("gone")]

  it("omits unavailable widgets in view mode", () => {
    expect(renderableItems(items, registry, "view").map((i) => i.widgetId)).toEqual(["revenue"])
  })

  it("keeps unavailable widgets (as placeholders) in edit mode", () => {
    expect(renderableItems(items, registry, "edit").map((i) => i.widgetId)).toEqual([
      "revenue",
      "gone",
    ])
  })
})

describe("constraintsFromRegistry", () => {
  it("only includes widgets that declare size constraints", () => {
    const reg = buildRegistry([widget("a", { minSize: { width: 3, height: 2 } }), widget("b")])
    const constraints = constraintsFromRegistry(reg)
    expect(constraints.a).toEqual({ minSize: { width: 3, height: 2 }, maxSize: undefined })
    expect(constraints.b).toBeUndefined()
  })
})

describe("catalogCandidates", () => {
  it("excludes widgets already placed on the layout", () => {
    const widgets = [widget("revenue"), widget("bookings"), widget("margin")]
    const candidates = catalogCandidates(widgets, [place("revenue")])
    expect(candidates.map((w) => w.id)).toEqual(["bookings", "margin"])
  })
})
