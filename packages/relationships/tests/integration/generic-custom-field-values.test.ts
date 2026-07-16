import {
  type CustomFieldValueOperationsRuntime,
  customFieldValueOperationsRuntimePort,
} from "@voyant-travel/core/runtime-port"
import {
  createAppCustomFieldDefinitionOwner,
  createCustomFieldsService,
  createCustomFieldTargetRegistry,
  operatorCustomFieldDefinitionOwner,
} from "@voyant-travel/custom-fields"
import { createCustomFieldRoutes } from "@voyant-travel/custom-fields/routes"
import { handleApiError } from "@voyant-travel/hono"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createRelationshipsRuntimePortContribution } from "../../src/runtime-contributor.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const targets = createCustomFieldTargetRegistry([
  {
    id: "person",
    namespace: "relationships",
    label: "Person",
    fieldTypes: ["text", "enum", "monetary"],
    capabilities: ["read", "write"],
    ownerUnitId: "@voyant-travel/relationships",
  },
])
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("generic custom-field value API with Relationships provider", () => {
  let db: PostgresJsDatabase
  let app: Hono
  let service: ReturnType<typeof createCustomFieldsService>
  const suffix = Math.random().toString(36).slice(2, 10)
  const personId = `pers_cfv_${suffix}`
  const operatorDefinitionId = `cfd_operator_${suffix}`
  const appDefinitionId = `cfd_app_${suffix}`
  const appOwner = createAppCustomFieldDefinitionOwner({
    appId: "app_test",
    namespace: "app--test",
  })

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
    await db.execute(
      sql`INSERT INTO people (id, first_name, last_name)
          VALUES (${personId}, 'Generic', 'Fields')`,
    )
    await db.execute(
      sql`INSERT INTO custom_field_definitions
        (id, entity_type, namespace, owner_kind, owner_id, lifecycle_state, provenance, key, label, field_type)
        VALUES
        (${operatorDefinitionId}, 'person', 'custom', 'operator', NULL, 'active', '{"source":"test"}', 'external_id', 'External ID', 'text'),
        (${appDefinitionId}, 'person', 'app--test', 'app', 'app_test', 'active', '{"source":"test"}', 'external_id', 'App external ID', 'text')`,
    )

    const runtime = createRelationshipsRuntimePortContribution({
      getRuntimePort: async <T>() =>
        ({
          resolveRegistry: async () => {
            throw new Error("not used by value operations")
          },
          resolveRegistryForWrite: async () => {
            throw new Error("not used by value operations")
          },
          resolveVisibleValues: async () => ({}),
        }) as unknown as T,
    })
    const valueOperations = runtime[
      customFieldValueOperationsRuntimePort.id
    ] as CustomFieldValueOperationsRuntime
    const routes = createCustomFieldRoutes(targets, { valueOperations: [valueOperations] })

    app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    app.route("/v1/admin/custom-fields", routes)

    service = createCustomFieldsService(targets, [], [valueOperations])
    await service.values.upsertForOwner(
      db,
      operatorCustomFieldDefinitionOwner,
      operatorDefinitionId,
      {
        entityType: "person",
        entityId: personId,
        textValue: "operator-initial",
      },
    )
    await service.values.upsertForOwner(db, appOwner, appDefinitionId, {
      entityType: "person",
      entityId: personId,
      textValue: "app-value",
    })
  })

  afterAll(async () => {
    if (!db) return
    await db.execute(sql`DELETE FROM people WHERE id = ${personId}`)
    await db.execute(
      sql`DELETE FROM custom_field_definitions
          WHERE id IN (${operatorDefinitionId}, ${appDefinitionId})`,
    )
  })

  it("serves canonical generic routes and persists the operator namespace", async () => {
    const upsert = await app.request(`/v1/admin/custom-fields/${operatorDefinitionId}/value`, {
      method: "PUT",
      ...json({
        entityType: "person",
        entityId: personId,
        textValue: "operator-value",
      }),
    })
    expect(upsert.status).toBe(200)
    await expect(upsert.json()).resolves.toMatchObject({
      data: {
        id: `person::${personId}::custom::${operatorDefinitionId}`,
        namespace: "custom",
        textValue: "operator-value",
      },
    })

    const list = await app.request(
      `/v1/admin/custom-fields/values?entityType=person&entityId=${personId}`,
    )
    expect(list.status).toBe(200)
    await expect(list.json()).resolves.toMatchObject({
      total: 1,
      data: [{ namespace: "custom", key: "external_id", textValue: "operator-value" }],
    })
  })

  it("keeps the same key independent across owner namespaces", async () => {
    const appValues = await service.values.listForOwner(db, appOwner, {
      entityType: "person",
      entityId: personId,
      limit: 50,
      offset: 0,
    })

    expect(appValues.data).toEqual([
      expect.objectContaining({
        id: `person::${personId}::app--test::${appDefinitionId}`,
        namespace: "app--test",
        key: "external_id",
        textValue: "app-value",
      }),
    ])
    const stored = await db.execute(sql`SELECT custom_fields FROM people WHERE id = ${personId}`)
    const values = stored[0]?.custom_fields as Record<string, Record<string, unknown>>
    expect(values).toMatchObject({
      custom: { external_id: "operator-value" },
      "app--test": { external_id: "app-value" },
    })
  })

  it("deletes only the addressed namespace and returns 404 for a missing entity", async () => {
    const valueId = `person::${personId}::custom::${operatorDefinitionId}`
    const deleted = await app.request(
      `/v1/admin/custom-fields/values/${encodeURIComponent(valueId)}`,
      { method: "DELETE" },
    )
    expect(deleted.status).toBe(200)

    const stored = await db.execute(sql`SELECT custom_fields FROM people WHERE id = ${personId}`)
    const values = stored[0]?.custom_fields as Record<string, Record<string, unknown>>
    expect(values.custom?.external_id).toBeUndefined()
    expect(values["app--test"]?.external_id).toBe("app-value")

    const missing = await app.request(`/v1/admin/custom-fields/${operatorDefinitionId}/value`, {
      method: "PUT",
      ...json({
        entityType: "person",
        entityId: "pers_missing",
        textValue: "missing",
      }),
    })
    expect(missing.status).toBe(404)
  })

  it("does not expose the removed Relationships value routes", async () => {
    expect((await app.request("/v1/admin/relationships/custom-field-values")).status).toBe(404)
  })
})
