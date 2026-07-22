import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it, vi } from "vitest"

import { fetchOverlaysForEntities, restoreOverlay, writeOverlay } from "./overlay-service.js"

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
  node_kind: "root",
  node_key: "root",
  field_path: fieldPath,
  locale: "en-GB",
  audience: "customer",
  market: "default",
  value,
  version: 1,
  id: `ovl_${entityId}_${fieldPath}`,
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
        node_kind: "root",
        node_key: "root",
        locale: "en-GB",
        audience: "customer",
        market: "default",
        value: "A!",
        version: 1,
        id: "ovl_prod_a_name",
      },
      {
        field_path: "description",
        node_kind: "root",
        node_key: "root",
        locale: "en-GB",
        audience: "customer",
        market: "default",
        value: "Desc A",
        version: 1,
        id: "ovl_prod_a_description",
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

describe("writeOverlay conflict handling", () => {
  it("translates empty insert returning after ON CONFLICT DO NOTHING without catching unique violations", async () => {
    const current = {
      id: "ovl_existing",
      entity_module: "products",
      entity_id: "prod_1",
      node_kind: "root",
      node_key: "root",
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: "default",
      value: "Existing",
      origin: { kind: "admin-ui", user_id: "usrp_other" },
      version: 1,
      editorial_note: null,
      deleted_at: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    }
    const selectRows = [[], [current]]
    const limit = vi.fn(async () => selectRows.shift() ?? [])
    const where = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const returning = vi.fn(async () => [])
    const onConflictDoNothing = vi.fn(() => ({ returning }))
    const values = vi.fn(() => ({ onConflictDoNothing }))
    const insert = vi.fn(() => ({ values }))
    const db = drizzleStub({ select, insert })

    await expect(
      writeOverlay(db, {
        entity_module: "products",
        entity_id: "prod_1",
        field_path: "title",
        locale: "en-GB",
        audience: "customer",
        value: "New",
        origin: { kind: "admin-ui", user_id: "usrp_test" },
        expected_version: null,
      }),
    ).rejects.toMatchObject({
      name: "OverlayVersionConflictError",
      currentVersion: 1,
      expectedVersion: null,
    })

    expect(onConflictDoNothing).toHaveBeenCalledTimes(1)
    expect(returning).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(2)
  })
})

describe("restoreOverlay idempotency", () => {
  it("does not update or append history when the overlay is already active", async () => {
    const active = {
      id: "ovl_active",
      entity_module: "products",
      entity_id: "prod_1",
      node_kind: "root",
      node_key: "root",
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: "default",
      value: "Active",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
      version: 1,
      editorial_note: null,
      deleted_at: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    }
    const limit = vi.fn(async () => [active])
    const where = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const update = vi.fn()
    const insert = vi.fn()
    const db = drizzleStub({ select, update, insert })

    await expect(restoreOverlay(db, "ovl_active")).resolves.toBeUndefined()

    expect(update).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("does not append duplicate restore history when the conditional update loses a race", async () => {
    const deleted = {
      id: "ovl_deleted",
      entity_module: "products",
      entity_id: "prod_1",
      node_kind: "root",
      node_key: "root",
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: "default",
      value: "Deleted",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
      version: 1,
      editorial_note: null,
      deleted_at: new Date("2026-01-02T00:00:00Z"),
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-02T00:00:00Z"),
    }
    const limit = vi.fn(async () => [deleted])
    const selectWhere = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where: selectWhere }))
    const select = vi.fn(() => ({ from }))
    const updateReturning = vi.fn(async () => [])
    const updateWhere = vi.fn(() => ({ returning: updateReturning }))
    const set = vi.fn(() => ({ where: updateWhere }))
    const update = vi.fn(() => ({ set }))
    const insert = vi.fn()
    const db = drizzleStub({ select, update, insert })

    await expect(restoreOverlay(db, "ovl_deleted")).resolves.toBeUndefined()

    expect(update).toHaveBeenCalledTimes(1)
    expect(updateReturning).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
  })
})
