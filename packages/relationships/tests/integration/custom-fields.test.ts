import { handleApiError } from "@voyant-travel/hono"
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

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    const db = createTestDb()
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
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  describe("Custom Field Definitions", () => {
    const validDef = {
      entityType: "organization",
      key: "industry_code",
      label: "Industry Code",
      fieldType: "varchar",
    }

    it("creates a field definition", async () => {
      const res = await app.request("/custom-fields", {
        method: "POST",
        ...json(validDef),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.key).toBe("industry_code")
      expect(body.data.entityType).toBe("organization")
      expect(body.data.id).toBeTruthy()
    })

    it("rejects a duplicate (entityType, key) with a 409 field error", async () => {
      const first = await app.request("/custom-fields", { method: "POST", ...json(validDef) })
      expect(first.status).toBe(201)

      const res = await app.request("/custom-fields", {
        method: "POST",
        ...json({ ...validDef, label: "Industry Code (dup)" }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe("duplicate_custom_field_key")
      expect(body.error).toBe("Custom field key already exists for this entity type")
      expect(body.details.resource).toBe("custom_field_definition")
      expect(body.details.fields).toEqual({
        key: ["Custom field key already exists for this entity type"],
      })
      expect(body.details.issues).toEqual([
        {
          code: "duplicate_custom_field_key",
          path: ["key"],
          message: "Custom field key already exists for this entity type",
        },
      ])
    })

    it("lists definitions filtered by entityType", async () => {
      await app.request("/custom-fields", {
        method: "POST",
        ...json(validDef),
      })
      await app.request("/custom-fields", {
        method: "POST",
        ...json({ ...validDef, key: "other_field", label: "Other", entityType: "person" }),
      })

      const res = await app.request("/custom-fields?entityType=organization", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(1)
      expect(body.data[0].entityType).toBe("organization")
    })

    it("gets a definition by id", async () => {
      const createRes = await app.request("/custom-fields", {
        method: "POST",
        ...json(validDef),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/custom-fields/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.key).toBe("industry_code")
    })

    it("updates a definition", async () => {
      const createRes = await app.request("/custom-fields", {
        method: "POST",
        ...json(validDef),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/custom-fields/${created.id}`, {
        method: "PATCH",
        ...json({ label: "Updated Label" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.label).toBe("Updated Label")
    })

    it("deletes a definition", async () => {
      const createRes = await app.request("/custom-fields", {
        method: "POST",
        ...json(validDef),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/custom-fields/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent definition", async () => {
      const res = await app.request("/custom-fields/crm_cfd_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Custom Field Values", () => {
    async function seedDefinition() {
      const res = await app.request("/custom-fields", {
        method: "POST",
        ...json({
          entityType: "organization",
          key: `field_${Date.now()}`,
          label: "Test Field",
          fieldType: "varchar",
        }),
      })
      const { data } = await res.json()
      return data
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
