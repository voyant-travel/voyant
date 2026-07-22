/**
 * Integration tests for the sourced-entry service — exercises the
 * drizzle-bound surface (`upsertSourcedEntry`, `readSourcedEntry`,
 * `markSourcedEntryWithdrawn`, `createReadProvenance`) against a real
 * Postgres test database.
 *
 * Skips locally if `TEST_DATABASE_URL` is unset or the connection fails.
 * Schema must be present — apply
 * `packages/catalog/migrations/0001_*` (the sourced-entry migration) or
 * run `drizzle-kit push --force` against the test database first.
 */

import { newId } from "@voyant-travel/db/lib/typeid"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import type { CatalogProjection } from "../../src/adapter/contract.js"
import { catalogSourcedEntriesTable } from "../../src/schema-sourced-entries.js"
import {
  createSourcedPresentationSubjectIngestion,
  createReadProvenance,
  markSourcedEntryWithdrawn,
  type OwnedChecker,
  readSourcedEntryBySource,
  resolveSourcedPresentationSubject,
  readSourcedEntry,
  upsertSourcedEntry,
} from "../../src/services/sourced-entry-service.js"

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

describe.skipIf(!DB_AVAILABLE)("SourcedEntryService integration", () => {
  let db: PostgresJsDatabase

  beforeAll(() => {
    db = createTestDb()
  })

  const testEntityModule = "products"
  const testIdPrefix = `__test_se_${Date.now()}_`
  let createdEntityIds: string[] = []

  afterEach(async () => {
    for (const entityId of createdEntityIds) {
      await db
        .delete(catalogSourcedEntriesTable)
        .where(eq(catalogSourcedEntriesTable.entity_id, entityId))
    }
    createdEntityIds = []
  })

  function makeProjection(
    overrides: Partial<CatalogProjection> = {},
    fieldOverrides: Record<string, unknown> = {},
  ): CatalogProjection {
    const entityId = `${testIdPrefix}${newId("products")}`
    createdEntityIds.push(entityId)
    return {
      entity_module: testEntityModule,
      entity_id: entityId,
      provenance: {
        source_kind: "direct:tui",
        source_provider: "tui-uk",
        source_connection_id: "conn_tui_uk",
        source_ref: `TUI-${entityId}`,
        source_freshness: "sync",
        last_sourced_at: new Date(),
      },
      fields: { title: "Sample tour", duration_days: 5, ...fieldOverrides },
      ...overrides,
    }
  }

  it("upserts a fresh sourced-entry row with provenance + projection", async () => {
    const projection = makeProjection()
    const row = await upsertSourcedEntry(db, { projection })

    expect(row.entity_module).toBe(testEntityModule)
    expect(row.entity_id).toBe(projection.entity_id)
    expect(row.source_kind).toBe("direct:tui")
    expect(row.source_provider).toBe("tui-uk")
    expect(row.source_connection_id).toBe("conn_tui_uk")
    expect(row.source_ref).toBe(projection.provenance.source_ref)
    expect(row.source_freshness).toBe("sync")
    expect(row.status).toBe("active")
    expect(row.projection).toEqual({ title: "Sample tour", duration_days: 5 })
    expect(row.first_seen_at).toBeInstanceOf(Date)
    expect(row.last_seen_at).toBeInstanceOf(Date)
  })

  it("is idempotent on (entity_module, entity_id) — repeated upserts update the same row", async () => {
    const projection = makeProjection()

    const first = await upsertSourcedEntry(db, { projection })
    const initialFirstSeen = first.first_seen_at

    // Update the projection's fields (simulate a later discover() pass).
    const updated: CatalogProjection = {
      ...projection,
      fields: { title: "Sample tour (updated)", duration_days: 7 },
    }
    const second = await upsertSourcedEntry(db, { projection: updated })

    expect(second.id).toBe(first.id)
    expect(second.entity_id).toBe(first.entity_id)
    expect(second.projection).toEqual({
      title: "Sample tour (updated)",
      duration_days: 7,
    })
    // first_seen_at is preserved; last_seen_at + updated_at advance.
    expect(second.first_seen_at.getTime()).toBe(initialFirstSeen.getTime())
    expect(second.last_seen_at.getTime()).toBeGreaterThanOrEqual(first.last_seen_at.getTime())
  })

  it("rejects owned projections — they don't belong in the sourced-entry store", async () => {
    const projection = makeProjection({
      provenance: { source_kind: "owned", source_freshness: "static" },
    })
    await expect(upsertSourcedEntry(db, { projection })).rejects.toThrow(/owned/i)
  })

  it("readSourcedEntry returns the row by Voyant-side identity", async () => {
    const projection = makeProjection()
    await upsertSourcedEntry(db, { projection })

    const row = await readSourcedEntry(db, testEntityModule, projection.entity_id)
    expect(row).not.toBeNull()
    expect(row?.entity_id).toBe(projection.entity_id)
  })

  it("readSourcedEntry returns null for entities that aren't in the store", async () => {
    const row = await readSourcedEntry(db, testEntityModule, "missing_entity_xyz")
    expect(row).toBeNull()
  })

  it("resolves sourced presentation subjects to durable local identity by provenance", async () => {
    const source = {
      entityModule: "cruise-ships",
      idPrefix: "cruise_ships" as const,
      sourceKind: "direct:cruise-line",
      sourceProvider: "demo-line",
      sourceConnectionId: `conn_${testIdPrefix}`,
      sourceRef: `ship-${testIdPrefix}`,
    }

    const first = await resolveSourcedPresentationSubject(db, {
      ...source,
      projection: { name: "River Star", locale: "en-GB" },
    })
    createdEntityIds.push(first.entity_id)
    const second = await resolveSourcedPresentationSubject(db, {
      ...source,
      projection: { name: "River Star Updated", locale: "en-GB" },
    })

    expect(second.entity_id).toBe(first.entity_id)
    expect(second.projection).toMatchObject({ name: "River Star Updated" })

    const bySource = await readSourcedEntryBySource(db, source)
    expect(bySource?.entity_id).toBe(first.entity_id)
  })

  it.each([
    ["connected", `conn_concurrent_${testIdPrefix}`],
    ["connection-less", null],
  ])(
    "atomically resolves %s provider subjects under concurrent discovery",
    async (_, connectionId) => {
      const sourceRef = `ship-concurrent-${connectionId ?? "none"}-${testIdPrefix}`
      const ingest = createSourcedPresentationSubjectIngestion({
        entityModule: "cruise-ships",
        idPrefix: "cruise_ships",
      })

      const resolved = await Promise.all(
        Array.from({ length: 6 }, (_, revision) =>
          ingest(db, {
            sourceKind: "direct:cruise-line",
            sourceProvider: "demo-line",
            sourceConnectionId: connectionId,
            sourceRef,
            projection: { name: `River Star ${revision}`, locale: "en-GB" },
          }),
        ),
      )
      createdEntityIds.push(resolved[0]!.entity_id)

      expect(new Set(resolved.map((row) => row.entity_id)).size).toBe(1)
      const rows = await db
        .select({ entityId: catalogSourcedEntriesTable.entity_id })
        .from(catalogSourcedEntriesTable)
        .where(
          and(
            eq(catalogSourcedEntriesTable.entity_module, "cruise-ships"),
            eq(catalogSourcedEntriesTable.source_kind, "direct:cruise-line"),
            connectionId === null
              ? isNull(catalogSourcedEntriesTable.source_connection_id)
              : eq(catalogSourcedEntriesTable.source_connection_id, connectionId),
            eq(catalogSourcedEntriesTable.source_ref, sourceRef),
          ),
        )
      expect(rows).toEqual([{ entityId: resolved[0]!.entity_id }])
    },
  )

  it("keeps provider identity distinct across referenced-subject modules", async () => {
    const provenance = {
      sourceKind: "direct:shared-provider",
      sourceConnectionId: `conn_cross_module_${testIdPrefix}`,
      sourceRef: `shared-ref-${testIdPrefix}`,
      projection: { name: "Shared upstream ref" },
    }
    const ship = await createSourcedPresentationSubjectIngestion({
      entityModule: "cruise-ships",
      idPrefix: "cruise_ships",
    })(db, provenance)
    const property = await createSourcedPresentationSubjectIngestion({
      entityModule: "accommodation-properties",
      idPrefix: "properties",
    })(db, provenance)
    createdEntityIds.push(ship.entity_id, property.entity_id)

    expect(ship.entity_module).toBe("cruise-ships")
    expect(property.entity_module).toBe("accommodation-properties")
    expect(ship.entity_id).not.toBe(property.entity_id)
  })

  it("markSourcedEntryWithdrawn flips status without deleting the row", async () => {
    const projection = makeProjection()
    await upsertSourcedEntry(db, { projection })

    await markSourcedEntryWithdrawn(db, testEntityModule, projection.entity_id)

    const row = await readSourcedEntry(db, testEntityModule, projection.entity_id)
    expect(row?.status).toBe("withdrawn")
  })

  describe("createReadProvenance dispatch", () => {
    it("returns kind: 'sourced' for entities only in the sourced-entry store", async () => {
      const projection = makeProjection()
      await upsertSourcedEntry(db, { projection })

      // No owned-checker registered → falls through to sourced lookup.
      const readProvenance = createReadProvenance({})
      const result = await readProvenance(db, testEntityModule, projection.entity_id)

      expect(result?.kind).toBe("sourced")
      if (result?.kind === "sourced") {
        expect(result.provenance.source_kind).toBe("direct:tui")
        expect(result.provenance.source_connection_id).toBe("conn_tui_uk")
        expect(result.entry_id).toMatch(/^cse_/)
        expect(result.status).toBe("active")
        expect(result.projection).toEqual({ title: "Sample tour", duration_days: 5 })
      }
    })

    it("returns null when neither owned nor sourced-entry store has the row", async () => {
      const readProvenance = createReadProvenance({})
      const result = await readProvenance(db, testEntityModule, "missing_xyz")
      expect(result).toBeNull()
    })

    it("returns kind: 'owned' when the owned-checker reports the entity owned", async () => {
      const ownedChecker: OwnedChecker = async (_db, entityId) => entityId.startsWith("__owned_")
      const readProvenance = createReadProvenance({
        ownedCheckers: new Map([[testEntityModule, ownedChecker]]),
      })

      const result = await readProvenance(db, testEntityModule, "__owned_prod_abc")
      expect(result?.kind).toBe("owned")
    })

    it("falls through to sourced when the owned-checker returns false", async () => {
      const projection = makeProjection()
      await upsertSourcedEntry(db, { projection })

      const ownedChecker: OwnedChecker = async () => false
      const readProvenance = createReadProvenance({
        ownedCheckers: new Map([[testEntityModule, ownedChecker]]),
      })

      const result = await readProvenance(db, testEntityModule, projection.entity_id)
      expect(result?.kind).toBe("sourced")
    })
  })
})
