import { defineLink, type LinkableDefinition } from "@voyant-travel/core"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createLinkService, syncLinks } from "../../src/links.js"
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

const person: LinkableDefinition = {
  module: "linktest_crm",
  entity: "person",
  table: "linktest_people",
  idPrefix: "pers",
}

const product: LinkableDefinition = {
  module: "linktest_products",
  entity: "product",
  table: "linktest_products",
  idPrefix: "prod",
}

const post: LinkableDefinition = {
  module: "linktest_blog",
  entity: "post",
  table: "linktest_posts",
  idPrefix: "blpo",
}

// Definitions used across the test suite.
const personProductOneToMany = defineLink(person, {
  linkable: product,
  isList: true,
})
const personPostManyToMany = defineLink(
  { linkable: person, isList: true },
  { linkable: post, isList: true },
)

const LINK_TABLE_NAMES = [personProductOneToMany.tableName, personPostManyToMany.tableName]

function queryRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
}

async function dropLinkTables(db: PostgresJsDatabase): Promise<void> {
  for (const name of LINK_TABLE_NAMES) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${name}"`))
  }
}

describe.skipIf(!DB_AVAILABLE)("link service integration", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    db = createTestDb()
    await dropLinkTables(db)
    await syncLinks(db, [personProductOneToMany, personPostManyToMany])
  })

  afterAll(async () => {
    await dropLinkTables(db)
  })

  beforeEach(async () => {
    for (const name of LINK_TABLE_NAMES) {
      await db.execute(sql.raw(`TRUNCATE "${name}"`))
    }
  })

  describe("syncLinks", () => {
    it("creates both pivot tables", async () => {
      const found: string[] = []
      for (const name of LINK_TABLE_NAMES) {
        // agent-quality: raw-sql reviewed -- table name is bound as a value parameter.
        const rows = queryRows<{ tablename: string }>(
          await db.execute(
            sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ${name}`,
          ),
        )
        if (rows[0]) found.push(rows[0].tablename)
      }
      expect(found.sort()).toEqual([...LINK_TABLE_NAMES].sort())
    })

    it("is idempotent (safe to re-run)", async () => {
      await expect(
        syncLinks(db, [personProductOneToMany, personPostManyToMany]),
      ).resolves.toBeUndefined()
    })

    it("creates the expected columns", async () => {
      // agent-quality: raw-sql reviewed -- table name is bound as a value parameter.
      const rows = queryRows<{ column_name: string }>(
        await db.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${personProductOneToMany.tableName} ORDER BY column_name`,
        ),
      )
      const cols = rows.map((r) => r.column_name).sort()
      expect(cols).toEqual(
        [
          "id",
          personProductOneToMany.leftColumn,
          personProductOneToMany.rightColumn,
          "created_at",
          "updated_at",
          "deleted_at",
        ].sort(),
      )
    })
  })

  describe("createLinkService.create", () => {
    it("inserts a new link row via positional API", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      const row = await svc.create(personProductOneToMany.tableName, "pers_alice", "prod_xyz")
      expect(row.id).toMatch(/^lnk_/)
      expect(row.leftId).toBe("pers_alice")
      expect(row.rightId).toBe("prod_xyz")
      expect(row.deletedAt).toBeNull()
    })

    it("inserts a new link row via spec API", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      const row = await svc.create({
        linktest_crm: { person_id: "pers_alice" },
        linktest_products: { product_id: "prod_xyz" },
      })
      expect(row.leftId).toBe("pers_alice")
      expect(row.rightId).toBe("prod_xyz")
    })

    it("resolves reversed spec-key order", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      const row = await svc.create({
        linktest_products: { product_id: "prod_xyz" },
        linktest_crm: { person_id: "pers_alice" },
      })
      expect(row.leftId).toBe("pers_alice")
      expect(row.rightId).toBe("prod_xyz")
    })

    it("is idempotent — repeating create returns the same row", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      const first = await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      const second = await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      expect(second.id).toBe(first.id)

      const rows = await svc.list(personProductOneToMany.tableName)
      expect(rows).toHaveLength(1)
    })

    it("resurrects a soft-deleted pair on re-create", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      const created = await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.dismiss(personProductOneToMany.tableName, "pers_a", "prod_1")

      const recreated = await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      expect(recreated.id).toBe(created.id)
      expect(recreated.deletedAt).toBeNull()

      const rows = await svc.list(personProductOneToMany.tableName)
      expect(rows).toHaveLength(1)
    })

    it("throws when linkKey is unknown", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await expect(svc.create("nonexistent_table", "pers_a", "prod_1")).rejects.toThrow(
        /unknown link key/,
      )
    })
  })

  describe("createLinkService.list", () => {
    it("lists links filtered by left ID", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_2")
      await svc.create(personProductOneToMany.tableName, "pers_b", "prod_3")

      const rows = await svc.list(personProductOneToMany.tableName, {
        leftId: "pers_a",
      })
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.rightId).sort()).toEqual(["prod_1", "prod_2"])
    })

    it("lists links filtered by right ID", async () => {
      const svc = createLinkService(() => db, [personPostManyToMany])
      await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_b", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_c", "blpo_2")

      const rows = await svc.list(personPostManyToMany.tableName, {
        rightId: "blpo_1",
      })
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.leftId).sort()).toEqual(["pers_a", "pers_b"])
    })

    it("excludes soft-deleted rows from list results", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_2")
      await svc.dismiss(personProductOneToMany.tableName, "pers_a", "prod_1")

      const rows = await svc.list(personProductOneToMany.tableName, {
        leftId: "pers_a",
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.rightId).toBe("prod_2")
    })

    it("lists links matching any of the given left IDs (one batched query)", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_2")
      await svc.create(personProductOneToMany.tableName, "pers_b", "prod_3")
      await svc.create(personProductOneToMany.tableName, "pers_c", "prod_4")

      const rows = await svc.list(personProductOneToMany.tableName, {
        leftIds: ["pers_a", "pers_b"],
      })
      expect(rows).toHaveLength(3)
      expect(rows.map((r) => r.rightId).sort()).toEqual(["prod_1", "prod_2", "prod_3"])
    })

    it("lists links matching any of the given right IDs (one batched query)", async () => {
      const svc = createLinkService(() => db, [personPostManyToMany])
      await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_b", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_c", "blpo_2")
      await svc.create(personPostManyToMany.tableName, "pers_d", "blpo_3")

      const rows = await svc.list(personPostManyToMany.tableName, {
        rightIds: ["blpo_1", "blpo_2"],
      })
      expect(rows).toHaveLength(3)
      expect(rows.map((r) => r.leftId).sort()).toEqual(["pers_a", "pers_b", "pers_c"])
    })

    it("excludes soft-deleted rows from batched results", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.create(personProductOneToMany.tableName, "pers_b", "prod_2")
      await svc.dismiss(personProductOneToMany.tableName, "pers_a", "prod_1")

      const rows = await svc.list(personProductOneToMany.tableName, {
        leftIds: ["pers_a", "pers_b"],
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.rightId).toBe("prod_2")
    })

    it("returns no rows for an empty batched filter", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await expect(svc.list(personProductOneToMany.tableName, { leftIds: [] })).resolves.toEqual([])
    })

    it("returns all rows when no filter is provided", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.create(personProductOneToMany.tableName, "pers_b", "prod_2")
      const rows = await svc.list(personProductOneToMany.tableName)
      expect(rows).toHaveLength(2)
    })
  })

  describe("createLinkService.dismiss", () => {
    it("marks a link as soft-deleted", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.dismiss(personProductOneToMany.tableName, "pers_a", "prod_1")

      const rows = await svc.list(personProductOneToMany.tableName)
      expect(rows).toHaveLength(0)

      // But the physical row still exists.
      const dbRows = queryRows<unknown>(
        await db.execute(
          sql.raw(
            `SELECT * FROM "${personProductOneToMany.tableName}" WHERE "deleted_at" IS NOT NULL`,
          ),
        ),
      )
      expect(dbRows.length).toBe(1)
    })

    it("is a no-op when pair does not exist", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await expect(
        svc.dismiss(personProductOneToMany.tableName, "pers_x", "prod_x"),
      ).resolves.toBeUndefined()
    })
  })

  describe("createLinkService.delete", () => {
    it("hard-deletes the link row", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await svc.delete(personProductOneToMany.tableName, "pers_a", "prod_1")

      const dbRows = queryRows<unknown>(
        await db.execute(sql.raw(`SELECT * FROM "${personProductOneToMany.tableName}"`)),
      )
      expect(dbRows.length).toBe(0)
    })
  })

  describe("one-to-many enforcement", () => {
    it("allows multiple rights per left", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      await expect(
        svc.create(personProductOneToMany.tableName, "pers_a", "prod_2"),
      ).resolves.toBeDefined()
    })

    it("rejects a second parent for the same right (UNIQUE on right_id)", async () => {
      const svc = createLinkService(() => db, [personProductOneToMany])
      await svc.create(personProductOneToMany.tableName, "pers_a", "prod_1")
      // Since product.isList=false here isn't the case — flip assumption:
      // personProductOneToMany is person:(product, isList=true) → each product
      // is owned by exactly one person. A second person claiming prod_1 must
      // be rejected by UNIQUE(products_product_id).
      // ON CONFLICT DO NOTHING returns no row, then we fetch the active
      // pair (which won't match a different left), and throw.
      await expect(
        svc.create(personProductOneToMany.tableName, "pers_b", "prod_1"),
      ).rejects.toThrow()
    })
  })

  describe("many-to-many enforcement", () => {
    it("allows the same left across multiple rights", async () => {
      const svc = createLinkService(() => db, [personPostManyToMany])
      await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_2")
      const rows = await svc.list(personPostManyToMany.tableName, {
        leftId: "pers_a",
      })
      expect(rows).toHaveLength(2)
    })

    it("allows the same right across multiple lefts", async () => {
      const svc = createLinkService(() => db, [personPostManyToMany])
      await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      await svc.create(personPostManyToMany.tableName, "pers_b", "blpo_1")
      const rows = await svc.list(personPostManyToMany.tableName, {
        rightId: "blpo_1",
      })
      expect(rows).toHaveLength(2)
    })

    it("dedupes duplicate pairs (pair unique index)", async () => {
      const svc = createLinkService(() => db, [personPostManyToMany])
      const a = await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      const b = await svc.create(personPostManyToMany.tableName, "pers_a", "blpo_1")
      expect(a.id).toBe(b.id)
    })
  })
})
