import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { crmRoutes } from "../../src/routes/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
const jsonWithIdempotency = (body: Record<string, unknown>, key: string) => ({
  headers: { "Content-Type": "application/json", "Idempotency-Key": key },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Account routes", () => {
  let app: Hono

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    const db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", crmRoutes)
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  describe("Organizations", () => {
    it("creates an organization", async () => {
      const res = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "Acme Corp" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe("Acme Corp")
      expect(body.data.id).toBeTruthy()
      expect(body.data.status).toBe("active")
    })

    it("replays organization creates with the same idempotency key", async () => {
      const input = { name: "Idempotent Org" }
      const first = await app.request("/organizations", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-org-create-1"),
      })
      const replay = await app.request("/organizations", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-org-create-1"),
      })

      expect(first.status).toBe(201)
      expect(replay.status).toBe(201)
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
      const firstBody = await first.json()
      const replayBody = await replay.json()
      expect(replayBody.data.id).toBe(firstBody.data.id)
    })

    it("lists organizations", async () => {
      await app.request("/organizations", { method: "POST", ...json({ name: "Org A" }) })
      await app.request("/organizations", { method: "POST", ...json({ name: "Org B" }) })

      const res = await app.request("/organizations", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(2)
    })

    it("gets an organization by id", async () => {
      const createRes = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "GetMe" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/organizations/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("GetMe")
    })

    it("updates an organization", async () => {
      const createRes = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "Old Name" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/organizations/${created.id}`, {
        method: "PATCH",
        ...json({ name: "New Name" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("New Name")
    })

    it("deletes an organization", async () => {
      const createRes = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "ToDelete" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/organizations/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent organization", async () => {
      const res = await app.request("/organizations/crm_org_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("creates an organization note", async () => {
      const createRes = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "Notes Org" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/organizations/${created.id}/notes`, {
        method: "POST",
        ...json({ content: "Call back next week" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.content).toBe("Call back next week")
      expect(body.data.authorUserId).toBe("test-user-id")
    })
  })

  describe("People", () => {
    it("creates a person", async () => {
      const res = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "John", lastName: "Doe" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.firstName).toBe("John")
      expect(body.data.lastName).toBe("Doe")
      expect(body.data.id).toBeTruthy()
    })

    it("replays person creates with the same idempotency key", async () => {
      const input = { firstName: "Idempotent", lastName: "Person" }
      const first = await app.request("/people", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-person-create-1"),
      })
      const replay = await app.request("/people", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-person-create-1"),
      })

      expect(first.status).toBe(201)
      expect(replay.status).toBe(201)
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
      const firstBody = await first.json()
      const replayBody = await replay.json()
      expect(replayBody.data.id).toBe(firstBody.data.id)
    })

    it("reflects contact-point updates without an explicit rebuild (#446 view)", async () => {
      // Replaces the old projection-cache assertion: the
      // `person_directory` view computes email/phone/website live, so
      // edits to `identity_contact_points` should flow through the
      // next list read with no rebuild call in between.
      const { identityService } = await import("@voyantjs/identity/service")
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Live", lastName: "View", email: "first@example.com" }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data

      // Mutate the underlying contact point directly — bypassing the
      // person service's own update path on purpose.
      const { createTestDb } = await import("@voyantjs/db/test-utils")
      const db = createTestDb()
      const contactPoints = await identityService.listContactPointsForEntity(
        db,
        "person",
        created.id,
      )
      const emailCp = contactPoints.find((p) => p.kind === "email")
      if (!emailCp) throw new Error("expected seeded email contact point")
      await identityService.updateContactPoint(db, emailCp.id, {
        entityType: "person",
        entityId: created.id,
        kind: "email",
        value: "second@example.com",
      })

      const refreshed = await app.request(`/people/${created.id}`, { method: "GET" })
      expect(refreshed.status).toBe(200)
      const body = await refreshed.json()
      expect(body.data.email).toBe("second@example.com")
    })

    it("hydrates inline person identity fields on create and list reads", async () => {
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({
          firstName: "Identity",
          lastName: "Person",
          email: "identity@example.com",
          phone: "+40123456789",
          website: "https://example.com",
        }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.email).toBe("identity@example.com")
      expect(createBody.data.website).toBe("https://example.com")

      const listRes = await app.request("/people", { method: "GET" })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data[0]?.email).toBe("identity@example.com")
      expect(listBody.data[0]?.phone).toBe("+40123456789")
    })

    it("lists people", async () => {
      await app.request("/people", {
        method: "POST",
        ...json({ firstName: "A", lastName: "One" }),
      })

      const res = await app.request("/people", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeTypeOf("number")
    })

    it("gets a person by id", async () => {
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Jane", lastName: "Doe" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/people/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.firstName).toBe("Jane")
    })

    it("updates a person", async () => {
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Old", lastName: "Name" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/people/${created.id}`, {
        method: "PATCH",
        ...json({ firstName: "New" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.firstName).toBe("New")
    })

    it("deletes a person", async () => {
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Del", lastName: "Ete" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/people/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent person", async () => {
      const res = await app.request("/people/crm_ppl_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("creates a person note", async () => {
      const createRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Note", lastName: "Person" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/people/${created.id}/notes`, {
        method: "POST",
        ...json({ content: "Prefers email outreach" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.content).toBe("Prefers email outreach")
      expect(body.data.authorUserId).toBe("test-user-id")
    })
  })
})
