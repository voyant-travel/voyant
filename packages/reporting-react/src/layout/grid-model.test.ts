import { describe, expect, it } from "vitest"
import type { LayoutItem } from "../types.js"
import {
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
  sortReadingOrder,
} from "./grid-model.js"

const item = (over: Partial<LayoutItem> & { widgetId: string }): LayoutItem => ({
  x: 0,
  y: 0,
  width: 3,
  height: 2,
  ...over,
})

describe("clamp", () => {
  it("bounds values and coerces NaN to the minimum", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
    expect(clamp(Number.NaN, 2, 10)).toBe(2)
  })
})

describe("normalizeItem", () => {
  it("clamps width to the column count and keeps x within bounds", () => {
    const result = normalizeItem(item({ widgetId: "a", x: 11, width: 20 }), 12)
    expect(result.width).toBe(12)
    expect(result.x).toBe(0)
  })

  it("rounds fractional pointer positions onto whole cells", () => {
    const result = normalizeItem(
      item({ widgetId: "a", x: 2.6, y: 1.4, width: 3.5, height: 2.2 }),
      12,
    )
    expect(result).toMatchObject({ x: 3, y: 1, width: 4, height: 2 })
  })

  it("honours widget min/max size constraints", () => {
    const result = normalizeItem(item({ widgetId: "a", width: 1, height: 1 }), 12, {
      minSize: { width: 4, height: 3 },
      maxSize: { width: 8, height: 6 },
    })
    expect(result.width).toBe(4)
    expect(result.height).toBe(3)
  })

  it("never lets x push the item past the right edge", () => {
    const result = normalizeItem(item({ widgetId: "a", x: 10, width: 6 }), 12)
    expect(result.x + result.width).toBeLessThanOrEqual(12)
  })
})

describe("normalizeLayout", () => {
  it("normalizes every item and applies per-widget constraints", () => {
    const items = [item({ widgetId: "a", x: 20, width: 20 }), item({ widgetId: "b", width: 1 })]
    const result = normalizeLayout(items, 12, {
      b: { minSize: { width: 5, height: 1 } },
    })
    expect(result[0]?.width).toBe(12)
    expect(result[1]?.width).toBe(5)
  })
})

describe("itemsOverlap", () => {
  it("detects overlapping and non-overlapping rectangles", () => {
    const a = item({ widgetId: "a", x: 0, y: 0, width: 3, height: 2 })
    const b = item({ widgetId: "b", x: 2, y: 1, width: 3, height: 2 })
    const c = item({ widgetId: "c", x: 3, y: 0, width: 3, height: 2 })
    expect(itemsOverlap(a, b)).toBe(true)
    expect(itemsOverlap(a, c)).toBe(false)
  })
})

describe("sortReadingOrder", () => {
  it("orders top-to-bottom then left-to-right, deterministically", () => {
    const items = [
      item({ widgetId: "c", x: 6, y: 0 }),
      item({ widgetId: "a", x: 0, y: 0 }),
      item({ widgetId: "b", x: 0, y: 2 }),
    ]
    expect(sortReadingOrder(items).map((i) => i.widgetId)).toEqual(["a", "c", "b"])
  })
})

describe("findVacantPosition / addItem", () => {
  it("places a new item in the first free slot without overlap", () => {
    const items = [item({ widgetId: "a", x: 0, y: 0, width: 12, height: 2 })]
    const pos = findVacantPosition(items, { width: 6, height: 2 }, 12)
    expect(pos).toEqual({ x: 0, y: 2 })
  })

  it("appends deterministically and does not overlap existing items", () => {
    const items = [item({ widgetId: "a", x: 0, y: 0, width: 12, height: 2 })]
    const next = addItem(items, "b", { width: 4, height: 2 }, 12)
    const added = next.find((i) => i.widgetId === "b")
    expect(added).toBeDefined()
    expect(items.some((i) => added && itemsOverlap(added, i))).toBe(false)
  })
})

describe("moveItem (keyboard fallback)", () => {
  it("moves by whole cells and clamps at the edges", () => {
    const items = [item({ widgetId: "a", x: 0, y: 0, width: 3, height: 2 })]
    const moved = moveItem(items, "a", { dx: -1, dy: -1 }, 12)
    expect(moved[0]).toMatchObject({ x: 0, y: 0 })
    const right = moveItem(items, "a", { dx: 2, dy: 3 }, 12)
    expect(right[0]).toMatchObject({ x: 2, y: 3 })
  })

  it("returns an unchanged copy for an unknown widget id", () => {
    const items = [item({ widgetId: "a" })]
    expect(moveItem(items, "missing", { dx: 1, dy: 1 }, 12)).toEqual(items)
  })
})

describe("resizeItem (keyboard fallback)", () => {
  it("resizes by whole cells within constraints", () => {
    const items = [item({ widgetId: "a", x: 0, y: 0, width: 3, height: 2 })]
    const bigger = resizeItem(items, "a", { dWidth: 2, dHeight: 1 }, 12)
    expect(bigger[0]).toMatchObject({ width: 5, height: 3 })
    const clamped = resizeItem(items, "a", { dWidth: -5, dHeight: -5 }, 12, {
      minSize: { width: 2, height: 1 },
    })
    expect(clamped[0]).toMatchObject({ width: 2, height: 1 })
  })
})

describe("removeItem", () => {
  it("removes by widget id", () => {
    const items = [item({ widgetId: "a" }), item({ widgetId: "b" })]
    expect(removeItem(items, "a").map((i) => i.widgetId)).toEqual(["b"])
  })
})

describe("projectToNarrow", () => {
  it("stacks items full-width in reading order with contiguous rows", () => {
    const items = [
      item({ widgetId: "b", x: 6, y: 0, width: 6, height: 3 }),
      item({ widgetId: "a", x: 0, y: 0, width: 6, height: 2 }),
      item({ widgetId: "c", x: 0, y: 3, width: 12, height: 1 }),
    ]
    const narrow = projectToNarrow(items)
    expect(narrow.map((i) => i.widgetId)).toEqual(["a", "b", "c"])
    expect(narrow.every((i) => i.x === 0 && i.width === 1)).toBe(true)
    expect(narrow.map((i) => i.y)).toEqual([0, 2, 5])
  })

  it("is deterministic regardless of input array order", () => {
    const a = item({ widgetId: "a", x: 0, y: 0 })
    const b = item({ widgetId: "b", x: 0, y: 2 })
    expect(projectToNarrow([a, b])).toEqual(projectToNarrow([b, a]))
  })
})
