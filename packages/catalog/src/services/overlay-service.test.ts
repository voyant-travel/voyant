import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"

import { fetchOverlaysForEntities } from "./overlay-service.js"

function drizzleStub(methods: Partial<Record<keyof AnyDrizzleDb, unknown>>): AnyDrizzleDb {
  return methods as never
}

/**
 * Minimal mock for the `db.select({...}).from(...).where(...)` chain the
 * batched overlay fetch issues. Every `select` call is counted so tests can
 * assert the one-query contract.
 */
function mockDb(rows: ReadonlyArray<Record<string, unknown>>) {
  let selectCalls = 0
  const db = drizzleStub({
    select: () => {
      selectCalls++
      return {
        from: () => ({
          where: async () => rows,
        }),
      }
    },
  })
  return { db, selectCount: () => selectCalls }
}

const overlayRow = (entityId: string, fieldPath: string, value: unknown) => ({
  entity_id: entityId,
  field_path: fieldPath,
  locale: "en-GB",
  audience: "customer",
  market: "default",
  value,
})

describe("fetchOverlaysForEntities", () => {
  it("fetches overlays for many entities in one query, grouped by entity id", async () => {
    const { db, selectCount } = mockDb([
      overlayRow("prod_a", "name", "A!"),
      overlayRow("prod_b", "name", "B!"),
      overlayRow("prod_a", "description", "Desc A"),
    ])

    const result = await fetchOverlaysForEntities(db, "products", ["prod_a", "prod_b"])

    expect(selectCount()).toBe(1)
    expect(result.get("prod_a")).toEqual([
      {
        field_path: "name",
        locale: "en-GB",
        audience: "customer",
        market: "default",
        value: "A!",
      },
      {
        field_path: "description",
        locale: "en-GB",
        audience: "customer",
        market: "default",
        value: "Desc A",
      },
    ])
    expect(result.get("prod_b")).toHaveLength(1)
  })

  it("pre-seeds every requested id so entities without overlays map to []", async () => {
    const { db } = mockDb([overlayRow("prod_a", "name", "A!")])

    const result = await fetchOverlaysForEntities(db, "products", ["prod_a", "prod_none"])

    expect(result.get("prod_none")).toEqual([])
    expect([...result.keys()]).toEqual(["prod_a", "prod_none"])
  })

  it("returns an empty map without querying when no ids are passed", async () => {
    const { db, selectCount } = mockDb([])

    const result = await fetchOverlaysForEntities(db, "products", [])

    expect(result.size).toBe(0)
    expect(selectCount()).toBe(0)
  })

  it("dedupes repeated ids (one map entry, one query)", async () => {
    const { db, selectCount } = mockDb([overlayRow("prod_a", "name", "A!")])

    const result = await fetchOverlaysForEntities(db, "products", ["prod_a", "prod_a"])

    expect(selectCount()).toBe(1)
    expect(result.size).toBe(1)
    expect(result.get("prod_a")).toHaveLength(1)
  })
})
