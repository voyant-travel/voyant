import { handleApiError } from "@voyant-travel/hono"
import { sql } from "drizzle-orm"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { relationshipsRoutes } from "../../src/routes/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Custom field routes", () => {
  let app: Hono
  // biome-ignore lint/suspicious/noExplicitAny: integration DB handle is provided by the shared test utility.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    // Mirror production error mapping (createApp's errorBoundary) so thrown
    // ApiHttpErrors (e.g. 404 on a missing entity row) surface as real statuses.
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", relationshipsRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  describe("Custom Field Values", () => {
    async function seedDefinition() {
      const id = `cfd_route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const key = `field_${Date.now()}`
      await db.execute(sql`
        INSERT INTO custom_field_definitions (
          id,
          entity_type,
          namespace,
          owner_kind,
          owner_id,
          lifecycle_state,
          provenance,
          key,
          label,
          field_type
        )
        VALUES (
          ${id},
          'organization',
          'custom',
          'operator',
          NULL,
          'active',
          '{"source":"integration-test"}'::jsonb,
          ${key},
          'Test Field',
          'varchar'
        )
      `)
      return { id, key }
    }

    // The value API stores onto the entity's `custom_fields` column and now
    // 404s when no entity row matches, so values must target a real org row.
    async function seedOrganization() {
      const res = await app.request("/organizations", {
        method: "POST",
        ...json({ name: `Org ${Date.now()}` }),
      })
      const { data } = await res.json()
      return data.id as string
    }

    it("upserts a value (create)", async () => {
      const def = await seedDefinition()
      const orgId = await seedOrganization()

      const res = await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: orgId,
          textValue: "hello",
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.textValue).toBe("hello")
      expect(body.data.definitionId).toBe(def.id)
    })

    it("404s an upsert against a nonexistent entity row", async () => {
      const def = await seedDefinition()

      const res = await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: "crm_org_does_not_exist",
          textValue: "hello",
        }),
      })

      expect(res.status).toBe(404)
    })

    it("lists values filtered by entity", async () => {
      const def = await seedDefinition()
      const orgId = await seedOrganization()
      await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: orgId,
          textValue: "val1",
        }),
      })

      const res = await app.request(
        `/custom-field-values?entityType=organization&entityId=${orgId}`,
        { method: "GET" },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(1)
    })

    it("upserts a value (update existing)", async () => {
      const def = await seedDefinition()
      const orgId = await seedOrganization()

      await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: orgId,
          textValue: "original",
        }),
      })

      const res = await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: orgId,
          textValue: "updated",
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.textValue).toBe("updated")

      const listRes = await app.request(
        `/custom-field-values?entityType=organization&entityId=${orgId}`,
        { method: "GET" },
      )
      const listBody = await listRes.json()
      expect(listBody.data.length).toBe(1)
    })

    it("deletes a value", async () => {
      const def = await seedDefinition()
      const orgId = await seedOrganization()

      const upsertRes = await app.request(`/custom-fields/${def.id}/value`, {
        method: "PUT",
        ...json({
          entityType: "organization",
          entityId: orgId,
          textValue: "todelete",
        }),
      })
      const { data: value } = await upsertRes.json()

      const res = await app.request(`/custom-field-values/${value.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})
