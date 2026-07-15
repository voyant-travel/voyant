import {
  defineLink,
  type LinkableDefinition,
  type LinkDefinition,
  type LinkRow,
} from "@voyant-travel/core"
import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vitest"

import { createLinkService, createLinkServiceFactory, syncLinks } from "../../src/links.js"

const person: LinkableDefinition = {
  module: "crm",
  entity: "person",
  table: "people",
  idPrefix: "pers",
}

const product: LinkableDefinition = {
  module: "products",
  entity: "product",
  table: "products",
  idPrefix: "prod",
}

function makeRow(id: string, leftId: string, rightId: string): LinkRow {
  const now = new Date()
  return {
    id,
    leftId,
    rightId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

// -- list: batched ID filters (SQL path, mocked execute) --------------------

const dialect = new PgDialect()

/** Mock Drizzle client capturing every executed query as rendered SQL + params. */
function makeMockDb(rows: Record<string, unknown>[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const execute = vi.fn(async (query: SQL) => {
    calls.push(dialect.sqlToQuery(query))
    return rows
  })
  return { db: { execute } as never, execute, calls }
}

function makeRawRow(
  def: { leftColumn: string; rightColumn: string },
  leftId: string,
  rightId: string,
) {
  return {
    id: "lnk_1",
    [def.leftColumn]: leftId,
    [def.rightColumn]: rightId,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  }
}

describe("createLinkServiceFactory", () => {
  it("rejects a malformed selected link definition", () => {
    const malformedLink: LinkDefinition = {
      ...defineLink(person, product),
      tableName: "",
    }

    expect(() => createLinkServiceFactory([malformedLink])).toThrow(
      "invalid link definition at index 0; missing tableName",
    )
  })

  it("validates duplicate table names when the factory is created", () => {
    const link = defineLink(person, product)

    expect(() => createLinkServiceFactory([link, link])).toThrow(
      `duplicate link definition for table "${link.tableName}"`,
    )
  })

  it("builds independent services against request-local databases", async () => {
    const link = defineLink(person, product)
    const first = makeMockDb()
    const second = makeMockDb()
    const createForRequest = createLinkServiceFactory([link])

    await createForRequest(() => first.db).list(link.tableName)
    await createForRequest(() => second.db).list(link.tableName)

    expect(first.execute).toHaveBeenCalledTimes(1)
    expect(second.execute).toHaveBeenCalledTimes(1)
  })
})

describe("list — batched ID filters", () => {
  const link = defineLink(person, { linkable: product, isList: true })

  it("resolves leftIds with ONE `= ANY($1)` query and maps the rows", async () => {
    const { db, execute, calls } = makeMockDb([makeRawRow(link, "pers_a", "prod_1")])
    const svc = createLinkService(() => db, [link])

    const rows = await svc.list(link.tableName, { leftIds: ["pers_a", "pers_b"] })

    expect(execute).toHaveBeenCalledTimes(1)
    const query = calls[0]
    expect(query?.sql).toContain(`"${link.leftColumn}" = ANY($1)`)
    expect(query?.sql).toContain(`"deleted_at" IS NULL`)
    expect(query?.sql).toContain(`ORDER BY "created_at" ASC`)
    expect(query?.params).toEqual([["pers_a", "pers_b"]])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.leftId).toBe("pers_a")
    expect(rows[0]?.rightId).toBe("prod_1")
    expect(rows[0]?.createdAt).toBeInstanceOf(Date)
  })

  it("resolves rightIds with ONE `= ANY($1)` query", async () => {
    const { db, execute, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, { rightIds: ["prod_1", "prod_2", "prod_3"] })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(calls[0]?.sql).toContain(`"${link.rightColumn}" = ANY($1)`)
    expect(calls[0]?.params).toEqual([["prod_1", "prod_2", "prod_3"]])
  })

  it("keeps the singular equality shape for `leftId`", async () => {
    const { db, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, { leftId: "pers_a" })

    expect(calls[0]?.sql).toContain(`"${link.leftColumn}" = $1`)
    expect(calls[0]?.sql).not.toContain("ANY")
    expect(calls[0]?.params).toEqual(["pers_a"])
  })

  it("collapses a one-element array to plain equality", async () => {
    const { db, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, { leftIds: ["pers_a"] })

    expect(calls[0]?.sql).toContain(`"${link.leftColumn}" = $1`)
    expect(calls[0]?.sql).not.toContain("ANY")
    expect(calls[0]?.params).toEqual(["pers_a"])
  })

  it("dedupes repeated ids within a batched filter", async () => {
    const { db, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, { leftIds: ["pers_a", "pers_a", "pers_b"] })

    expect(calls[0]?.params).toEqual([["pers_a", "pers_b"]])
  })

  it("combines leftIds and rightIds in the same single query", async () => {
    const { db, execute, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, {
      leftIds: ["pers_a", "pers_b"],
      rightIds: ["prod_1", "prod_2"],
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(calls[0]?.sql).toContain(`"${link.leftColumn}" = ANY($1)`)
    expect(calls[0]?.sql).toContain(`"${link.rightColumn}" = ANY($2)`)
    expect(calls[0]?.params).toEqual([
      ["pers_a", "pers_b"],
      ["prod_1", "prod_2"],
    ])
  })

  it("intersects a singular id with the matching batched filter", async () => {
    const { db, calls } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await svc.list(link.tableName, { leftId: "pers_a", leftIds: ["pers_a", "pers_b"] })

    expect(calls[0]?.sql).toContain(`"${link.leftColumn}" = $1`)
    expect(calls[0]?.params).toEqual(["pers_a"])
  })

  it("short-circuits to [] without querying when leftIds is empty", async () => {
    const { db, execute } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await expect(svc.list(link.tableName, { leftIds: [] })).resolves.toEqual([])
    await expect(svc.list(link.tableName, { rightIds: [] })).resolves.toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })

  it("short-circuits to [] when the singular id is outside the batched set", async () => {
    const { db, execute } = makeMockDb()
    const svc = createLinkService(() => db, [link])

    await expect(
      svc.list(link.tableName, { leftId: "pers_z", leftIds: ["pers_a", "pers_b"] }),
    ).resolves.toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })
})

describe("read-only links", () => {
  it("lists rows from the externally-owned resolver", async () => {
    const list = vi.fn(async () => [makeRow("lnk_1", "pers_a", "prod_1")])
    const link = defineLink(person, { linkable: product, isList: true }, { readOnly: { list } })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    const rows = await svc.list(link.tableName, { leftId: "pers_a" })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.rightId).toBe("prod_1")
    expect(list).toHaveBeenCalledWith({ leftId: "pers_a" })
  })

  it("fans batched leftIds out to the resolver one singular call per id", async () => {
    const list = vi.fn(async (filter?: { leftId?: string; rightId?: string }) => {
      if (filter?.leftId === "pers_a") return [makeRow("lnk_1", "pers_a", "prod_1")]
      if (filter?.leftId === "pers_b") return [makeRow("lnk_2", "pers_b", "prod_2")]
      return []
    })
    const link = defineLink(person, { linkable: product, isList: true }, { readOnly: { list } })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    const rows = await svc.list(link.tableName, { leftIds: ["pers_a", "pers_b", "pers_c"] })

    expect(list).toHaveBeenCalledTimes(3)
    expect(list).toHaveBeenCalledWith({ leftId: "pers_a" })
    expect(list).toHaveBeenCalledWith({ leftId: "pers_b" })
    expect(list).toHaveBeenCalledWith({ leftId: "pers_c" })
    expect(rows.map((r) => r.rightId)).toEqual(["prod_1", "prod_2"])
  })

  it("collapses a one-element batched filter to the resolver's singular shape", async () => {
    const list = vi.fn(async () => [makeRow("lnk_1", "pers_a", "prod_1")])
    const link = defineLink(person, { linkable: product, isList: true }, { readOnly: { list } })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    await svc.list(link.tableName, { leftIds: ["pers_a"] })

    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ leftId: "pers_a" })
  })

  it("applies the second batched side locally when both sides are batched", async () => {
    const list = vi.fn(async (filter?: { leftId?: string; rightId?: string }) => {
      if (filter?.leftId === "pers_a") {
        return [
          makeRow("lnk_1", "pers_a", "prod_1"),
          makeRow("lnk_2", "pers_a", "prod_2"),
          makeRow("lnk_3", "pers_a", "prod_3"),
        ]
      }
      return []
    })
    const link = defineLink(person, { linkable: product, isList: true }, { readOnly: { list } })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    const rows = await svc.list(link.tableName, {
      leftIds: ["pers_a", "pers_b"],
      rightIds: ["prod_1", "prod_3"],
    })

    // Resolver only ever sees singular left filters …
    expect(list).toHaveBeenCalledWith({ leftId: "pers_a" })
    expect(list).toHaveBeenCalledWith({ leftId: "pers_b" })
    // … and the right-side set is applied locally.
    expect(rows.map((r) => r.rightId)).toEqual(["prod_1", "prod_3"])
  })

  it("short-circuits empty batched filters without calling the resolver", async () => {
    const list = vi.fn(async () => [makeRow("lnk_1", "pers_a", "prod_1")])
    const link = defineLink(person, { linkable: product, isList: true }, { readOnly: { list } })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    await expect(svc.list(link.tableName, { leftIds: [] })).resolves.toEqual([])
    expect(list).not.toHaveBeenCalled()
  })

  it("rejects mutations against read-only links", async () => {
    const link = defineLink(person, product, {
      readOnly: { list: async () => [] },
    })
    const svc = createLinkService(() => ({ execute: vi.fn() }) as never, [link])

    await expect(svc.create(link.tableName, "pers_a", "prod_1")).rejects.toThrow(/read-only link/)
    await expect(svc.dismiss(link.tableName, "pers_a", "prod_1")).rejects.toThrow(/read-only link/)
    await expect(svc.delete(link.tableName, "pers_a", "prod_1")).rejects.toThrow(/read-only link/)
  })

  it("skips read-only links during sync", async () => {
    const execute = vi.fn()
    const db = { execute } as never
    const managed = defineLink(person, product)
    const readOnly = defineLink(
      person,
      { linkable: product, isList: true },
      {
        database: { tableName: "crm_person_products_product_read_only" },
        readOnly: { list: async () => [] },
      },
    )

    await syncLinks(db, [managed, readOnly])

    expect(execute).toHaveBeenCalledTimes(4)
  })
})
