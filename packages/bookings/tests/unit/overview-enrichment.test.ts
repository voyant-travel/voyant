import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import { applyOverviewEnrichers } from "../../src/overview-enrichment.js"
import type { BookingOverviewItemEnricher } from "../../src/route-runtime.js"

// The helper never touches the db itself — enrichers do — so a stub is fine.
const db = {} as PostgresJsDatabase

function item(id: string, itemType: string) {
  return { id, itemType, productId: null, optionId: null, title: `item-${id}` }
}

describe("applyOverviewEnrichers", () => {
  it("returns items unchanged when no enrichers are registered", async () => {
    const items = [item("bkit_1", "accommodation"), item("bkit_2", "unit")]
    const result = await applyOverviewEnrichers(db, items, undefined)
    expect(result).toBe(items)
    expect(result.every((entry) => !("details" in entry))).toBe(true)
  })

  it("attaches details only to items the enricher resolves, leaving others untouched", async () => {
    const items = [
      item("bkit_1", "accommodation"),
      item("bkit_2", "accommodation"),
      item("bkit_3", "unit"),
    ]

    const enrich: BookingOverviewItemEnricher = async (_db, given) => {
      // Only the items of the registered type are handed to the enricher.
      expect(given.map((entry) => entry.id)).toEqual(["bkit_1", "bkit_2"])
      return new Map<string, unknown>([["bkit_1", { kind: "accommodation", nights: 2 }]])
    }

    const result = await applyOverviewEnrichers(db, items, { accommodation: enrich })

    const byId = new Map(result.map((entry) => [entry.id, entry]))
    expect(byId.get("bkit_1")).toMatchObject({ details: { kind: "accommodation", nights: 2 } })
    expect("details" in byId.get("bkit_2")!).toBe(false)
    expect("details" in byId.get("bkit_3")!).toBe(false)
  })

  it("invokes each enricher once with only its item-type group", async () => {
    const items = [
      item("bkit_1", "accommodation"),
      item("bkit_2", "transport"),
      item("bkit_3", "accommodation"),
    ]
    const accommodation = vi.fn(async () => new Map<string, unknown>())
    const transport = vi.fn(async () => new Map<string, unknown>())

    await applyOverviewEnrichers(db, items, { accommodation, transport })

    expect(accommodation).toHaveBeenCalledTimes(1)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(accommodation.mock.calls[0]![1].map((entry) => entry.id)).toEqual(["bkit_1", "bkit_3"])
    expect(transport.mock.calls[0]![1].map((entry) => entry.id)).toEqual(["bkit_2"])
  })

  it("swallows a throwing enricher and still returns the overview items", async () => {
    const items = [item("bkit_1", "accommodation"), item("bkit_2", "transport")]

    const boom: BookingOverviewItemEnricher = async () => {
      throw new Error("detail join blew up")
    }
    const transport: BookingOverviewItemEnricher = async () =>
      new Map<string, unknown>([["bkit_2", { kind: "transport" }]])

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await applyOverviewEnrichers(db, items, { accommodation: boom, transport })
    errorSpy.mockRestore()

    const byId = new Map(result.map((entry) => [entry.id, entry]))
    // Failed vertical is skipped; the healthy vertical still enriches.
    expect("details" in byId.get("bkit_1")!).toBe(false)
    expect(byId.get("bkit_2")).toMatchObject({ details: { kind: "transport" } })
  })
})
