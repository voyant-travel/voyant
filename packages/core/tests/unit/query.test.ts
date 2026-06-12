// agent-quality: file-size exception -- owner: core; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { describe, expect, it, vi } from "vitest"

import {
  defineLink,
  type LinkableDefinition,
  type LinkListFilter,
  type LinkRow,
  type LinkService,
} from "../../src/links.js"
import {
  createQueryContext,
  type EntityFetcher,
  type EntityFetcherArgs,
  type EntityRecord,
  queryGraph,
} from "../../src/query.js"

// -- Test linkables --------------------------------------------------------

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

const organization: LinkableDefinition = {
  module: "crm",
  entity: "organization",
  table: "organizations",
  idPrefix: "org",
}

// -- Test helpers ----------------------------------------------------------

function makeFetcher(records: EntityRecord[]): EntityFetcher {
  return {
    list: vi.fn(async (args: EntityFetcherArgs) => {
      if (args.ids) {
        const ids = new Set(args.ids)
        return records.filter((r) => ids.has(r.id))
      }
      let result = records
      if (args.pagination) {
        const { skip = 0, take } = args.pagination
        result = take !== undefined ? result.slice(skip, skip + take) : result.slice(skip)
      }
      return result
    }),
  }
}

function makeLinkService(rowsByKey: Record<string, LinkRow[]>): LinkService {
  return {
    create: vi.fn(),
    dismiss: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async (linkKey: string, filter: LinkListFilter = {}) => {
      const all = rowsByKey[linkKey] ?? []
      return all.filter((row) => {
        if (filter.leftId !== undefined && row.leftId !== filter.leftId) return false
        if (filter.rightId !== undefined && row.rightId !== filter.rightId) return false
        if (filter.leftIds !== undefined && !filter.leftIds.includes(row.leftId)) return false
        if (filter.rightIds !== undefined && !filter.rightIds.includes(row.rightId)) return false
        return true
      })
    }),
    // biome-ignore lint/suspicious/noExplicitAny: LinkService has overloaded signatures -- owner: core; existing suppression is intentional pending typed cleanup.
  } as any
}

function makeRow(
  id: string,
  leftId: string,
  rightId: string,
  deletedAt: Date | null = null,
): LinkRow {
  const now = new Date()
  return { id, leftId, rightId, createdAt: now, updatedAt: now, deletedAt }
}

// -- Tests -----------------------------------------------------------------

describe("createQueryContext", () => {
  it("builds a context from plain records", () => {
    const ctx = createQueryContext(
      { person: makeFetcher([]) },
      [defineLink(person, product)],
      makeLinkService({}),
    )
    expect(ctx.fetchers.size).toBe(1)
    expect(ctx.fetchers.has("person")).toBe(true)
    expect(ctx.links).toHaveLength(1)
  })

  it("preserves the provided link service and links list", () => {
    const linkService = makeLinkService({})
    const links = [defineLink(person, product), defineLink(person, organization)]
    const ctx = createQueryContext({}, links, linkService)
    expect(ctx.linkService).toBe(linkService)
    expect(ctx.links).toBe(links)
  })
})

describe("queryGraph — base fetch", () => {
  it("returns records from the base entity with no relations", async () => {
    const fetcher = makeFetcher([
      { id: "pers_a", name: "Alice" },
      { id: "pers_b", name: "Bob" },
    ])
    const ctx = createQueryContext({ person: fetcher }, [], makeLinkService({}))

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "name"],
    })
    expect(data).toHaveLength(2)
    expect(data[0]?.name).toBe("Alice")
    expect(fetcher.list).toHaveBeenCalledWith({
      filters: undefined,
      pagination: undefined,
      context: undefined,
    })
  })

  it("passes filters and pagination through to the fetcher", async () => {
    const fetcher = makeFetcher([
      { id: "pers_a", name: "Alice" },
      { id: "pers_b", name: "Bob" },
      { id: "pers_c", name: "Carol" },
    ])
    const ctx = createQueryContext({ person: fetcher }, [], makeLinkService({}))

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id"],
      filters: { country: "FR" },
      pagination: { skip: 1, take: 1 },
    })
    expect(data).toHaveLength(1)
    expect(data[0]?.id).toBe("pers_b")
    expect(fetcher.list).toHaveBeenCalledWith({
      filters: { country: "FR" },
      pagination: { skip: 1, take: 1 },
      context: undefined,
    })
  })

  it("passes query context through to the base fetcher", async () => {
    const fetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const ctx = createQueryContext({ person: fetcher }, [], makeLinkService({}))

    await queryGraph(ctx, {
      entity: "person",
      fields: ["id"],
      context: { locale: "ro", market: "ro" },
    })

    expect(fetcher.list).toHaveBeenCalledWith({
      filters: undefined,
      pagination: undefined,
      context: { locale: "ro", market: "ro" },
    })
  })

  it("returns empty data without calling any link services", async () => {
    const linkService = makeLinkService({})
    const ctx = createQueryContext({ person: makeFetcher([]) }, [], linkService)

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "product.*"],
    })
    expect(data).toEqual([])
    expect(linkService.list).not.toHaveBeenCalled()
  })

  it("throws when no fetcher is registered for the base entity", async () => {
    const ctx = createQueryContext({}, [], makeLinkService({}))
    await expect(queryGraph(ctx, { entity: "person", fields: ["id"] })).rejects.toThrow(
      /no fetcher registered for entity "person"/,
    )
  })
})

describe("queryGraph — relation traversal", () => {
  const personProductLink = defineLink(person, { linkable: product, isList: true })

  it("attaches a list relation (one-to-many)", async () => {
    const personFetcher = makeFetcher([
      { id: "pers_a", name: "Alice" },
      { id: "pers_b", name: "Bob" },
    ])
    const productFetcher = makeFetcher([
      { id: "prod_1", title: "Safari" },
      { id: "prod_2", title: "Cruise" },
      { id: "prod_3", title: "Hike" },
    ])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [
        makeRow("lnk_1", "pers_a", "prod_1"),
        makeRow("lnk_2", "pers_a", "prod_2"),
        makeRow("lnk_3", "pers_b", "prod_3"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "name", "product.*"],
    })

    expect(data).toHaveLength(2)
    const alice = data.find((r) => r.id === "pers_a")
    const bob = data.find((r) => r.id === "pers_b")
    expect(Array.isArray(alice?.product)).toBe(true)
    expect((alice?.product as EntityRecord[]).map((p) => p.id).sort()).toEqual(["prod_1", "prod_2"])
    expect(bob?.product as EntityRecord[]).toHaveLength(1)
    expect((bob?.product as EntityRecord[])[0]?.id).toBe("prod_3")
  })

  it("passes query context through to related entity hydration", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const productFetcher = makeFetcher([{ id: "prod_1", title: "Safari" }])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [makeRow("lnk_1", "pers_a", "prod_1")],
    })
    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "product.*"],
      context: { locale: "en", market: "uk" },
    })

    expect(productFetcher.list).toHaveBeenCalledWith({
      ids: ["prod_1"],
      context: { locale: "en", market: "uk" },
    })
  })

  it("attaches an empty list when no links exist for a record", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const productFetcher = makeFetcher([])
    const linkService = makeLinkService({ [personProductLink.tableName]: [] })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["product.*"],
    })
    expect(data[0]?.product).toEqual([])
  })

  it("attaches a single relation (one-to-one)", async () => {
    const personOrgLink = defineLink({ linkable: person, isList: true }, organization)
    // person (many) ↔ organization (one) — each person belongs to exactly one org
    const personFetcher = makeFetcher([
      { id: "pers_a", name: "Alice" },
      { id: "pers_b", name: "Bob" },
      { id: "pers_c", name: "Carol" },
    ])
    const orgFetcher = makeFetcher([
      { id: "org_x", name: "Acme" },
      { id: "org_y", name: "Globex" },
    ])
    const linkService = makeLinkService({
      [personOrgLink.tableName]: [
        makeRow("lnk_1", "pers_a", "org_x"),
        makeRow("lnk_2", "pers_b", "org_x"),
        makeRow("lnk_3", "pers_c", "org_y"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, organization: orgFetcher },
      [personOrgLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "organization.name"],
    })

    const alice = data.find((r) => r.id === "pers_a")
    const carol = data.find((r) => r.id === "pers_c")
    expect(alice?.organization).toEqual({ id: "org_x", name: "Acme" })
    expect(carol?.organization).toEqual({ id: "org_y", name: "Globex" })
  })

  it("returns null for a missing single relation", async () => {
    const personOrgLink = defineLink({ linkable: person, isList: true }, organization)
    const personFetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const orgFetcher = makeFetcher([])
    const linkService = makeLinkService({ [personOrgLink.tableName]: [] })

    const ctx = createQueryContext(
      { person: personFetcher, organization: orgFetcher },
      [personOrgLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["organization.*"],
    })
    expect(data[0]?.organization).toBeNull()
  })

  it("traverses a link from the right side (reversed)", async () => {
    // Query product → person (person is on the left of the link)
    const personFetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const productFetcher = makeFetcher([
      { id: "prod_1", title: "Safari" },
      { id: "prod_2", title: "Cruise" },
    ])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [
        makeRow("lnk_1", "pers_a", "prod_1"),
        makeRow("lnk_2", "pers_a", "prod_2"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "product",
      fields: ["id", "person.*"],
    })

    // product.person is single (person is not a list on the link)
    const p1 = data.find((r) => r.id === "prod_1")
    expect(p1?.person).toEqual({ id: "pers_a", name: "Alice" })
  })

  it("throws when a dotted field has no matching link definition", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }])
    const ctx = createQueryContext({ person: personFetcher }, [], makeLinkService({}))

    await expect(
      queryGraph(ctx, {
        entity: "person",
        fields: ["id", "mystery.*"],
      }),
    ).rejects.toThrow(/no link definition found for "person\.mystery"/)
  })

  it("throws when the target entity has no registered fetcher", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }])
    const linkService = makeLinkService({ [personProductLink.tableName]: [] })
    const ctx = createQueryContext({ person: personFetcher }, [personProductLink], linkService)

    await expect(
      queryGraph(ctx, { entity: "person", fields: ["id", "product.*"] }),
    ).rejects.toThrow(/no fetcher registered for target entity "product"/)
  })

  it("issues ONE batched link lookup for N base records", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }, { id: "pers_b" }, { id: "pers_c" }])
    const productFetcher = makeFetcher([
      { id: "prod_1", title: "Safari" },
      { id: "prod_2", title: "Cruise" },
    ])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [
        makeRow("lnk_1", "pers_a", "prod_1"),
        makeRow("lnk_2", "pers_a", "prod_2"),
        makeRow("lnk_3", "pers_c", "prod_2"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["id", "product.*"],
    })

    // One list call total, carrying every base id — not one call per record.
    expect(linkService.list).toHaveBeenCalledTimes(1)
    expect(linkService.list).toHaveBeenCalledWith(personProductLink.tableName, {
      leftIds: ["pers_a", "pers_b", "pers_c"],
    })

    // And the batched rows still group back to the right base records.
    const byId = new Map(data.map((r) => [r.id, r]))
    expect((byId.get("pers_a")?.product as EntityRecord[]).map((p) => p.id)).toEqual([
      "prod_1",
      "prod_2",
    ])
    expect(byId.get("pers_b")?.product).toEqual([])
    expect((byId.get("pers_c")?.product as EntityRecord[]).map((p) => p.id)).toEqual(["prod_2"])
  })

  it("issues ONE batched link lookup with rightIds when traversing from the right side", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a", name: "Alice" }])
    const productFetcher = makeFetcher([
      { id: "prod_1", title: "Safari" },
      { id: "prod_2", title: "Cruise" },
    ])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [
        makeRow("lnk_1", "pers_a", "prod_1"),
        makeRow("lnk_2", "pers_a", "prod_2"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "product",
      fields: ["id", "person.*"],
    })

    expect(linkService.list).toHaveBeenCalledTimes(1)
    expect(linkService.list).toHaveBeenCalledWith(personProductLink.tableName, {
      rightIds: ["prod_1", "prod_2"],
    })
    expect(data.find((r) => r.id === "prod_1")?.person).toEqual({ id: "pers_a", name: "Alice" })
    expect(data.find((r) => r.id === "prod_2")?.person).toEqual({ id: "pers_a", name: "Alice" })
  })

  it("dedupes base ids in the batched link lookup", async () => {
    // A fetcher can legitimately return the same record twice (e.g. a join
    // upstream); the link lookup should still carry each id once.
    const personFetcher: EntityFetcher = {
      list: vi.fn(async () => [
        { id: "pers_a", name: "Alice" },
        { id: "pers_a", name: "Alice" },
      ]),
    }
    const productFetcher = makeFetcher([{ id: "prod_1", title: "Safari" }])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [makeRow("lnk_1", "pers_a", "prod_1")],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, { entity: "person", fields: ["product.*"] })

    expect(linkService.list).toHaveBeenCalledWith(personProductLink.tableName, {
      leftIds: ["pers_a"],
    })
    // Both duplicate base records still get the relation attached.
    expect((data[0]?.product as EntityRecord[])[0]?.id).toBe("prod_1")
    expect((data[1]?.product as EntityRecord[])[0]?.id).toBe("prod_1")
  })

  it("dedupes target fetches across base records", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }, { id: "pers_b" }, { id: "pers_c" }])
    const productFetcher = makeFetcher([{ id: "prod_1", title: "Safari" }])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [
        makeRow("lnk_1", "pers_a", "prod_1"),
        makeRow("lnk_2", "pers_b", "prod_1"),
        makeRow("lnk_3", "pers_c", "prod_1"),
      ],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    await queryGraph(ctx, {
      entity: "person",
      fields: ["product.*"],
    })
    // Only a single call with the deduped target id list.
    expect(productFetcher.list).toHaveBeenCalledTimes(1)
    expect(productFetcher.list).toHaveBeenCalledWith({ ids: ["prod_1"] })
  })

  it("skips target hydration when no links match", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }])
    const productFetcher = makeFetcher([])
    const linkService = makeLinkService({ [personProductLink.tableName]: [] })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    await queryGraph(ctx, { entity: "person", fields: ["product.*"] })
    expect(productFetcher.list).not.toHaveBeenCalled()
  })

  it("groups multiple subfields under a single relation (one traversal)", async () => {
    const personFetcher = makeFetcher([{ id: "pers_a" }])
    const productFetcher = makeFetcher([{ id: "prod_1", title: "Safari", price: 100 }])
    const linkService = makeLinkService({
      [personProductLink.tableName]: [makeRow("lnk_1", "pers_a", "prod_1")],
    })

    const ctx = createQueryContext(
      { person: personFetcher, product: productFetcher },
      [personProductLink],
      linkService,
    )

    const { data } = await queryGraph(ctx, {
      entity: "person",
      fields: ["product.title", "product.price"],
    })
    // Only one hydration call even though two subfields were requested.
    expect(productFetcher.list).toHaveBeenCalledTimes(1)
    expect((data[0]?.product as EntityRecord[])[0]).toEqual({
      id: "prod_1",
      title: "Safari",
      price: 100,
    })
  })
})
