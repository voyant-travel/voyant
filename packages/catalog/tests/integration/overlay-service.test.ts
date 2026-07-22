/**
 * Integration tests for OverlayService — exercises the drizzle-bound surface
 * against a real Postgres test database.
 *
 * Skips locally if `TEST_DATABASE_URL` is unset or the connection fails.
 * Run with the test Postgres from `docker-compose.test.yml` (per the voyant
 * test convention) or any Postgres URL set via `TEST_DATABASE_URL`.
 *
 * Schema must be present — apply `packages/catalog/migrations/0000_catalog_initial.sql`
 * or run `drizzle-kit push --force` against the test database first.
 */

import { newId } from "@voyant-travel/db/lib/typeid"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { catalogOverlayTable, OVERLAY_DEFAULT_SCOPE } from "../../src/overlay/schema.js"
import {
  clearOverlayByTarget,
  fetchOverlaysForEntity,
  listOverlayHistoryForTarget,
  listOverlaysByOrigin,
  OverlayVersionConflictError,
  restoreOverlay,
  softDeleteOverlay,
  writeOverlay,
} from "../../src/services/overlay-service.js"

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

describe.skipIf(!DB_AVAILABLE)("OverlayService integration", () => {
  let db: PostgresJsDatabase

  beforeAll(() => {
    db = createTestDb()
  })

  // Use a unique entity_id per test run so concurrent tests don't collide.
  const testEntityModule = "products"
  const testEntityIdPrefix = `__test_${Date.now()}_`
  let createdEntityIds: string[] = []

  afterEach(async () => {
    // Cleanup: delete every overlay row created during the test by entity_id prefix.
    for (const entityId of createdEntityIds) {
      await db.delete(catalogOverlayTable).where(eq(catalogOverlayTable.entity_id, entityId))
    }
    createdEntityIds = []
  })

  afterAll(async () => {
    // Final sweep — clean up any rows our test entity-id prefix created.
    // (Defensive in case a test exited mid-flight.)
  })

  it("writeOverlay creates an active overlay row", async () => {
    const entityId = `${testEntityIdPrefix}write`
    createdEntityIds.push(entityId)

    const row = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "Marketing title",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    expect(row.id).toBeTruthy()
    expect(row.entity_id).toBe(entityId)
    expect(row.value).toBe("Marketing title")
    expect(row.deleted_at).toBeNull()
  })

  it("fetchOverlaysForEntity returns only active rows", async () => {
    const entityId = `${testEntityIdPrefix}fetch`
    createdEntityIds.push(entityId)

    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      value: "Hello",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "description",
      locale: "en-GB",
      audience: "customer",
      value: "World",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })

    const overlays = await fetchOverlaysForEntity(db, testEntityModule, entityId)
    expect(overlays).toHaveLength(2)
    expect(overlays.map((o) => o.field_path).sort()).toEqual(["description", "title"])
  })

  it("writeOverlay is idempotent: second write to the same key updates value", async () => {
    const entityId = `${testEntityIdPrefix}idempotent`
    createdEntityIds.push(entityId)

    const first = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "First value",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    const second = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "Second value",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    expect(second.id).toBe(first.id)
    expect(second.value).toBe("Second value")

    const overlays = await fetchOverlaysForEntity(db, testEntityModule, entityId)
    expect(overlays).toHaveLength(1)
  })

  it("detects stale write versions with a conditional update", async () => {
    const entityId = `${testEntityIdPrefix}stale_write`
    createdEntityIds.push(entityId)

    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "First value",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "Second value",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
      expected_version: 1,
    })

    await expect(
      writeOverlay(db, {
        entity_module: testEntityModule,
        entity_id: entityId,
        field_path: "title",
        locale: "en-GB",
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Stale value",
        origin: { kind: "admin-ui", user_id: "usrp_test" },
        expected_version: 1,
      }),
    ).rejects.toBeInstanceOf(OverlayVersionConflictError)

    const overlays = await fetchOverlaysForEntity(db, testEntityModule, entityId)
    expect(overlays[0]?.value).toBe("Second value")
  })

  it("writes mutation history in the same service call as the overlay mutation", async () => {
    const entityId = `${testEntityIdPrefix}history`
    createdEntityIds.push(entityId)

    const row = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "First value",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    await clearOverlayByTarget(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      node_kind: row.node_kind,
      node_key: row.node_key,
      field_path: row.field_path,
      locale: row.locale,
      audience: row.audience,
      market: row.market,
      expected_version: row.version,
    })

    const history = await listOverlayHistoryForTarget(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
    })
    expect(history.map((entry) => entry.action)).toEqual(["write", "clear"])
  })

  it("softDeleteOverlay removes the row from active fetches; restoreOverlay brings it back", async () => {
    const entityId = `${testEntityIdPrefix}soft_delete`
    createdEntityIds.push(entityId)

    const row = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      value: "To be deleted",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })

    await softDeleteOverlay(db, row.id)
    let overlays = await fetchOverlaysForEntity(db, testEntityModule, entityId)
    expect(overlays).toHaveLength(0)

    await restoreOverlay(db, row.id)
    overlays = await fetchOverlaysForEntity(db, testEntityModule, entityId)
    expect(overlays).toHaveLength(1)
    expect(overlays[0]?.value).toBe("To be deleted")
  })

  it("listOverlaysByOrigin filters by origin kind", async () => {
    const entityId = `${testEntityIdPrefix}origin_${newId("catalog_overlay")}`
    createdEntityIds.push(entityId)

    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      value: "From admin",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "description",
      locale: "en-GB",
      audience: "customer",
      value: "From CMS",
      origin: { kind: "cms", provider: "sanity", cms_doc_id: "doc_xyz" },
    })

    // Filter to just the rows our test wrote (by entity id) AND by origin kind.
    const cmsRows = await listOverlaysByOrigin(db, { kind: "cms" })
    const ourCmsRows = cmsRows.filter((r) => r.entity_id === entityId)
    expect(ourCmsRows).toHaveLength(1)
    expect(ourCmsRows[0]?.field_path).toBe("description")
  })

  it("active-row partial unique index allows recreating an overlay after soft-delete", async () => {
    const entityId = `${testEntityIdPrefix}recreate`
    createdEntityIds.push(entityId)

    const first = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "First",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    await softDeleteOverlay(db, first.id)

    const second = await writeOverlay(db, {
      entity_module: testEntityModule,
      entity_id: entityId,
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      value: "Second",
      origin: { kind: "admin-ui", user_id: "usrp_test" },
    })
    expect(second.id).not.toBe(first.id)
    expect(second.value).toBe("Second")
  })
})
