import { asc, desc, eq, sql } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { createCrudService } from "../../src/crud.js"
import { createTestDb } from "../../src/test-utils.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

// Ephemeral test table — created in beforeAll, dropped in afterAll.
// Uses plain text ids (no typeid column) to keep the test self-contained.
const crudItems = pgTable("crud_test_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tag: text("tag"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
})

// Table without updatedAt/deletedAt — exercises the "no optional columns" path.
const crudMinimal = pgTable("crud_test_minimal", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
})

describe.skipIf(!DB_AVAILABLE)("createCrudService", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    db = createTestDb()
    await db.execute(sql`DROP TABLE IF EXISTS crud_test_items`)
    await db.execute(sql`DROP TABLE IF EXISTS crud_test_minimal`)
    await db.execute(sql`
      CREATE TABLE crud_test_items (
        id text PRIMARY KEY,
        name text NOT NULL,
        tag text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `)
    await db.execute(sql`
      CREATE TABLE crud_test_minimal (
        id text PRIMARY KEY,
        label text NOT NULL
      )
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS crud_test_items`)
    await db.execute(sql`DROP TABLE IF EXISTS crud_test_minimal`)
  })

  afterEach(async () => {
    await db.execute(sql`TRUNCATE crud_test_items, crud_test_minimal`)
  })

  describe("factory construction", () => {
    it("throws when the table has no id column", () => {
      const badTable = pgTable("crud_bad", { name: text("name").notNull() })
      expect(() => createCrudService(badTable)).toThrow(/must declare an 'id' column/)
    })

    it("reports hasSoftDelete correctly", () => {
      const withSoft = createCrudService(crudItems)
      const withoutSoft = createCrudService(crudMinimal)
      expect(withSoft.hasSoftDelete).toBe(true)
      expect(withoutSoft.hasSoftDelete).toBe(false)
    })

    it("exposes the underlying table", () => {
      const svc = createCrudService(crudItems)
      expect(svc.table).toBe(crudItems)
    })
  })

  describe("create", () => {
    it("inserts a row and returns it", async () => {
      const svc = createCrudService(crudItems)
      const row = await svc.create(db, { id: "a", name: "Alpha" })
      expect(row.id).toBe("a")
      expect(row.name).toBe("Alpha")
      expect(row.createdAt).toBeInstanceOf(Date)
    })

    it("runs insertSchema validation when provided", async () => {
      const svc = createCrudService(crudItems, {
        insertSchema: z.object({ id: z.string(), name: z.string().min(3) }),
      })
      await expect(svc.create(db, { id: "b", name: "no" })).rejects.toThrow()
    })
  })

  describe("retrieve", () => {
    it("returns the row when it exists", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "r1", name: "Row1" })
      const found = await svc.retrieve(db, "r1")
      expect(found?.name).toBe("Row1")
    })

    it("returns null when missing", async () => {
      const svc = createCrudService(crudItems)
      const found = await svc.retrieve(db, "nope")
      expect(found).toBeNull()
    })
  })

  describe("list / count / listAndCount", () => {
    it("lists all rows", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "One" })
      await svc.create(db, { id: "2", name: "Two" })
      await svc.create(db, { id: "3", name: "Three" })
      const rows = await svc.list(db)
      expect(rows).toHaveLength(3)
    })

    it("filters by where clause", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "One", tag: "a" })
      await svc.create(db, { id: "2", name: "Two", tag: "b" })
      const rows = await svc.list(db, { where: eq(crudItems.tag, "a") })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe("1")
    })

    it("applies limit and offset", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "One" })
      await svc.create(db, { id: "2", name: "Two" })
      await svc.create(db, { id: "3", name: "Three" })
      const rows = await svc.list(db, { limit: 2, offset: 1, orderBy: asc(crudItems.id) })
      expect(rows).toHaveLength(2)
      expect(rows[0]?.id).toBe("2")
      expect(rows[1]?.id).toBe("3")
    })

    it("accepts a single orderBy clause or an array", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "B", tag: "x" })
      await svc.create(db, { id: "2", name: "A", tag: "x" })
      await svc.create(db, { id: "3", name: "A", tag: "y" })

      const single = await svc.list(db, { orderBy: desc(crudItems.name) })
      expect(single[0]?.name).toBe("B")

      const multi = await svc.list(db, {
        orderBy: [asc(crudItems.name), asc(crudItems.tag)],
      })
      expect(multi.map((r) => r.id)).toEqual(["2", "3", "1"])
    })

    it("counts rows with and without a where clause", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "One", tag: "a" })
      await svc.create(db, { id: "2", name: "Two", tag: "a" })
      await svc.create(db, { id: "3", name: "Three", tag: "b" })
      expect(await svc.count(db)).toBe(3)
      expect(await svc.count(db, eq(crudItems.tag, "a"))).toBe(2)
    })

    it("returns zero count when table is empty", async () => {
      const svc = createCrudService(crudItems)
      expect(await svc.count(db)).toBe(0)
    })

    it("returns paginated data + total via listAndCount", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "1", name: "One" })
      await svc.create(db, { id: "2", name: "Two" })
      await svc.create(db, { id: "3", name: "Three" })
      const res = await svc.listAndCount(db, { limit: 2, orderBy: asc(crudItems.id) })
      expect(res.data).toHaveLength(2)
      expect(res.total).toBe(3)
    })

    it("listAndCount rows never leak the window-total column", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "w1", name: "One" })
      const res = await svc.listAndCount(db, { limit: 10 })
      expect(res.data[0]).toBeDefined()
      expect(Object.keys(res.data[0] as object)).not.toContain("__voyantWindowTotal")
      expect(res.data[0]).toMatchObject({ id: "w1", name: "One" })
    })

    it("listAndCount reports the true total when offset points past the last row", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "o1", name: "One" })
      await svc.create(db, { id: "o2", name: "Two" })
      const res = await svc.listAndCount(db, { limit: 10, offset: 50 })
      expect(res.data).toHaveLength(0)
      expect(res.total).toBe(2)
    })

    it("listAndCount returns total 0 for an empty filtered set without an extra query", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "e1", name: "One", tag: "keep" })
      const res = await svc.listAndCount(db, { where: eq(crudItems.tag, "nope"), limit: 10 })
      expect(res.data).toHaveLength(0)
      expect(res.total).toBe(0)
    })
  })

  describe("update", () => {
    it("updates fields and sets updatedAt when column exists", async () => {
      const svc = createCrudService(crudItems)
      const created = await svc.create(db, { id: "u1", name: "Before" })
      // Force a slight time gap so updatedAt differs
      await new Promise((r) => setTimeout(r, 10))
      const updated = await svc.update(db, "u1", { name: "After" })
      expect(updated?.name).toBe("After")
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
    })

    it("does not fail when the table has no updatedAt column", async () => {
      const svc = createCrudService(crudMinimal)
      await svc.create(db, { id: "m1", label: "L1" })
      const updated = await svc.update(db, "m1", { label: "L2" })
      expect(updated?.label).toBe("L2")
    })

    it("returns null when the id does not exist", async () => {
      const svc = createCrudService(crudItems)
      const updated = await svc.update(db, "missing", { name: "x" })
      expect(updated).toBeNull()
    })

    it("runs updateSchema validation when provided", async () => {
      const svc = createCrudService(crudItems, {
        updateSchema: z.object({ name: z.string().min(3) }).partial(),
      })
      await svc.create(db, { id: "v1", name: "Valid" })
      await expect(svc.update(db, "v1", { name: "ab" })).rejects.toThrow()
    })
  })

  describe("delete", () => {
    it("hard-deletes a row and returns { id }", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "d1", name: "Doomed" })
      const result = await svc.delete(db, "d1")
      expect(result).toEqual({ id: "d1" })
      expect(await svc.retrieve(db, "d1")).toBeNull()
    })

    it("returns null when the id does not exist", async () => {
      const svc = createCrudService(crudItems)
      expect(await svc.delete(db, "missing")).toBeNull()
    })
  })

  describe("softDelete / restore", () => {
    it("sets deletedAt on softDelete and clears it on restore", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "s1", name: "Soft" })

      const deleted = await svc.softDelete(db, "s1")
      expect(deleted?.deletedAt).toBeInstanceOf(Date)

      const restored = await svc.restore(db, "s1")
      expect(restored?.deletedAt).toBeNull()
    })

    it("returns null when softDelete/restore id is missing", async () => {
      const svc = createCrudService(crudItems)
      expect(await svc.softDelete(db, "missing")).toBeNull()
      expect(await svc.restore(db, "missing")).toBeNull()
    })

    it("throws when softDelete is called on a table without deletedAt", async () => {
      const svc = createCrudService(crudMinimal)
      await svc.create(db, { id: "m2", label: "L" })
      await expect(svc.softDelete(db, "m2")).rejects.toThrow(/requires a 'deletedAt' column/)
    })

    it("throws when restore is called on a table without deletedAt", async () => {
      const svc = createCrudService(crudMinimal)
      await svc.create(db, { id: "m3", label: "L" })
      await expect(svc.restore(db, "m3")).rejects.toThrow(/requires a 'deletedAt' column/)
    })
  })

  describe("auto-filter on soft-deleted rows", () => {
    it("excludes soft-deleted rows from list() by default", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "a1", name: "Alive" })
      await svc.create(db, { id: "a2", name: "Tombstoned" })
      await svc.softDelete(db, "a2")

      const rows = await svc.list(db)
      expect(rows.map((r) => r.id)).toEqual(["a1"])
    })

    it("excludes soft-deleted rows from count() and listAndCount() by default", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "b1", name: "A" })
      await svc.create(db, { id: "b2", name: "B" })
      await svc.create(db, { id: "b3", name: "C" })
      await svc.softDelete(db, "b3")

      expect(await svc.count(db)).toBe(2)
      const { data, total } = await svc.listAndCount(db)
      expect(data).toHaveLength(2)
      expect(total).toBe(2)
    })

    it("excludes soft-deleted rows from retrieve() by default", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "r1", name: "Alive" })
      await svc.softDelete(db, "r1")
      expect(await svc.retrieve(db, "r1")).toBeNull()
    })

    it("includes soft-deleted rows when includeDeleted: true", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "i1", name: "Alive" })
      await svc.create(db, { id: "i2", name: "Tombstoned" })
      await svc.softDelete(db, "i2")

      const rows = await svc.list(db, { includeDeleted: true, orderBy: asc(crudItems.id) })
      expect(rows.map((r) => r.id)).toEqual(["i1", "i2"])

      expect(await svc.count(db, undefined, { includeDeleted: true })).toBe(2)
      const retrieved = await svc.retrieve(db, "i2", { includeDeleted: true })
      expect(retrieved?.id).toBe("i2")

      const { data, total } = await svc.listAndCount(db, { includeDeleted: true })
      expect(data).toHaveLength(2)
      expect(total).toBe(2)
    })

    it("composes user-supplied where clauses with the soft-delete filter", async () => {
      const svc = createCrudService(crudItems)
      await svc.create(db, { id: "c1", name: "Alive A", tag: "x" })
      await svc.create(db, { id: "c2", name: "Tombstoned X", tag: "x" })
      await svc.create(db, { id: "c3", name: "Alive B", tag: "y" })
      await svc.softDelete(db, "c2")

      const rows = await svc.list(db, { where: eq(crudItems.tag, "x") })
      expect(rows.map((r) => r.id)).toEqual(["c1"])
    })

    it("on tables without deletedAt, list() behaviour is unchanged", async () => {
      const svc = createCrudService(crudMinimal)
      await svc.create(db, { id: "n1", label: "A" })
      await svc.create(db, { id: "n2", label: "B" })
      const rows = await svc.list(db)
      expect(rows).toHaveLength(2)
    })
  })

  describe("composition", () => {
    it("supports spreading for custom service extensions", async () => {
      const crud = createCrudService(crudItems)
      const extended = {
        ...crud,
        async findByTag(client: PostgresJsDatabase, tag: string) {
          return crud.list(client, { where: eq(crudItems.tag, tag) })
        },
      }
      await extended.create(db, { id: "x1", name: "One", tag: "alpha" })
      await extended.create(db, { id: "x2", name: "Two", tag: "beta" })
      const alphas = await extended.findByTag(db, "alpha")
      expect(alphas).toHaveLength(1)
      expect(alphas[0]?.id).toBe("x1")
    })
  })
})
