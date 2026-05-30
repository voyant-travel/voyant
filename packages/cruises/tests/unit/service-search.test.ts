import { describe, expect, it } from "vitest"

import type { CruiseAdapter, CruiseSearchProjectionEntry } from "../../src/adapters/index.js"
import { cruisesSearchService, sourceRefIdentityJson } from "../../src/service-search.js"

describe("cruisesSearchService sourceRef identity", () => {
  it("keeps connection and provider context in external search-index identity", () => {
    const first = sourceRefIdentityJson({
      externalId: "same-id",
      connectionId: "conn-a",
      provider: "line-a",
    })
    const second = sourceRefIdentityJson({
      externalId: "same-id",
      connectionId: "conn-b",
      provider: "line-a",
    })

    expect(first).not.toBe(second)
  })

  it("is deterministic for nested SourceRef metadata", () => {
    const first = sourceRefIdentityJson({
      externalId: "same-id",
      metadata: { b: 2, a: 1 },
    })
    const second = sourceRefIdentityJson({
      metadata: { a: 1, b: 2 },
      externalId: "same-id",
    })

    expect(first).toBe(second)
  })
})

describe("cruisesSearchService external refresh pruning", () => {
  it("prunes existing provider scopes when a successful projection yields no entries", async () => {
    const db = {} as Parameters<typeof cruisesSearchService.refreshExternalForAdapter>[0]
    const calls: Array<{ sourceProvider: string; keepIds: string[]; connectionId: string | null }> =
      []
    const originalListExternalConnectionIds = cruisesSearchService.listExternalConnectionIds
    const originalRemoveExternalByIdsExcept = cruisesSearchService.removeExternalByIdsExcept

    cruisesSearchService.listExternalConnectionIds = async () => ["conn-a", null]
    cruisesSearchService.removeExternalByIdsExcept = async (
      _db,
      sourceProvider,
      keepIds,
      connectionId,
    ) => {
      calls.push({ sourceProvider, keepIds: [...keepIds], connectionId })
      return { removed: 1 }
    }

    try {
      const result = await cruisesSearchService.refreshExternalForAdapter(
        db,
        makeAdapter(async function* () {}),
      )

      expect(result).toEqual({ upserted: 0, removed: 2 })
      expect(calls).toEqual([
        { sourceProvider: "test-cruises", keepIds: [], connectionId: "conn-a" },
        { sourceProvider: "test-cruises", keepIds: [], connectionId: null },
      ])
    } finally {
      cruisesSearchService.listExternalConnectionIds = originalListExternalConnectionIds
      cruisesSearchService.removeExternalByIdsExcept = originalRemoveExternalByIdsExcept
    }
  })

  it("prunes missing existing scopes while keeping refreshed entries", async () => {
    const db = {} as Parameters<typeof cruisesSearchService.refreshExternalForAdapter>[0]
    const calls: Array<{ keepIds: string[]; connectionId: string | null }> = []
    const originalListExternalConnectionIds = cruisesSearchService.listExternalConnectionIds
    const originalRemoveExternalByIdsExcept = cruisesSearchService.removeExternalByIdsExcept
    const originalUpsertEntry = cruisesSearchService.upsertEntry

    cruisesSearchService.listExternalConnectionIds = async () => ["conn-a", "conn-b"]
    cruisesSearchService.upsertEntry = async () =>
      ({ id: "kept-row" }) as Awaited<ReturnType<typeof cruisesSearchService.upsertEntry>>
    cruisesSearchService.removeExternalByIdsExcept = async (
      _db,
      _sourceProvider,
      keepIds,
      connectionId,
    ) => {
      calls.push({ keepIds: [...keepIds], connectionId })
      return { removed: keepIds.length === 0 ? 2 : 1 }
    }

    try {
      const result = await cruisesSearchService.refreshExternalForAdapter(
        db,
        makeAdapter(async function* () {
          yield searchProjectionEntry({ externalId: "cruise-1", connectionId: "conn-a" })
        }),
      )

      expect(result).toEqual({ upserted: 1, removed: 3 })
      expect(calls).toEqual([
        { keepIds: ["kept-row"], connectionId: "conn-a" },
        { keepIds: [], connectionId: "conn-b" },
      ])
    } finally {
      cruisesSearchService.listExternalConnectionIds = originalListExternalConnectionIds
      cruisesSearchService.removeExternalByIdsExcept = originalRemoveExternalByIdsExcept
      cruisesSearchService.upsertEntry = originalUpsertEntry
    }
  })
})

function makeAdapter(searchProjection: CruiseAdapter["searchProjection"]): CruiseAdapter {
  return {
    name: "test-cruises",
    version: "1.0.0",
    searchProjection,
  } as CruiseAdapter
}

function searchProjectionEntry(
  sourceRef: CruiseSearchProjectionEntry["sourceRef"],
): CruiseSearchProjectionEntry {
  return {
    sourceRef,
    slug: `cruise-${sourceRef.externalId}`,
    name: "Test Cruise",
    cruiseType: "ocean",
    lineName: "Test Line",
    shipName: "Test Ship",
    nights: 7,
  }
}
