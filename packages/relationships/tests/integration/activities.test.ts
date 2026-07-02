import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { relationshipsRoutes } from "../../src/routes/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Activity routes", () => {
  let app: Hono

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    const db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
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

  describe("Activities CRUD", () => {
    it("creates an activity", async () => {
      const res = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Follow-up call", type: "call" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.subject).toBe("Follow-up call")
      expect(body.data.type).toBe("call")
      expect(body.data.status).toBe("planned")
      expect(body.data.id).toBeTruthy()
    })

    it("lists activities", async () => {
      await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Call A", type: "call" }),
      })
      await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Email B", type: "email" }),
      })

      const res = await app.request("/activities", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(2)
    })

    it("gets an activity by id", async () => {
      const createRes = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "GetMe", type: "meeting" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/activities/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.subject).toBe("GetMe")
    })

    it("updates an activity", async () => {
      const createRes = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Old Subject", type: "task" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/activities/${created.id}`, {
        method: "PATCH",
        ...json({ subject: "New Subject" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.subject).toBe("New Subject")
    })

    it("deletes an activity", async () => {
      const createRes = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "ToDelete", type: "note" }),
      })
      const { data: created } = await createRes.json()

      const res = await app.request(`/activities/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent activity", async () => {
      const res = await app.request("/activities/crm_act_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("auto-sets completedAt when status changes to done", async () => {
      const createRes = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Mark Done", type: "task" }),
      })
      const { data: created } = await createRes.json()
      expect(created.completedAt).toBeNull()

      const res = await app.request(`/activities/${created.id}`, {
        method: "PATCH",
        ...json({ status: "done" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("done")
      expect(body.data.completedAt).toBeTruthy()
    })
  })

  describe("Activity Links", () => {
    async function seedActivity() {
      const res = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Link Test", type: "call" }),
      })
      const { data } = await res.json()
      return data
    }

    async function seedOrganization() {
      const res = await app.request("/organizations", {
        method: "POST",
        ...json({ name: "Link Target Org" }),
      })
      const { data } = await res.json()
      return data
    }

    async function seedPerson() {
      const res = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Link", lastName: "Target" }),
      })
      const { data } = await res.json()
      return data
    }

    it("creates and lists links", async () => {
      const activity = await seedActivity()
      const organization = await seedOrganization()

      const createRes = await app.request(`/activities/${activity.id}/links`, {
        method: "POST",
        ...json({ entityType: "organization", entityId: organization.id }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.entityType).toBe("organization")
      expect(createBody.data.role).toBe("related")

      const listRes = await app.request(`/activities/${activity.id}/links`, { method: "GET" })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data.length).toBe(1)
    })

    it("rejects links to missing organizations", async () => {
      const activity = await seedActivity()

      const createRes = await app.request(`/activities/${activity.id}/links`, {
        method: "POST",
        ...json({ entityType: "organization", entityId: "org_missing" }),
      })

      expect(createRes.status).toBe(404)
      const createBody = await createRes.json()
      expect(createBody.error).toBe("Linked entity not found")

      const listRes = await app.request(
        "/activities?entityType=organization&entityId=org_missing",
        { method: "GET" },
      )

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data).toEqual([])
    })

    it("deletes a link", async () => {
      const activity = await seedActivity()
      const person = await seedPerson()

      const createRes = await app.request(`/activities/${activity.id}/links`, {
        method: "POST",
        ...json({ entityType: "person", entityId: person.id }),
      })
      const { data: link } = await createRes.json()

      const res = await app.request(`/activity-links/${link.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe("Activity Participants", () => {
    async function seedActivityAndPerson() {
      const actRes = await app.request("/activities", {
        method: "POST",
        ...json({ subject: "Participant Test", type: "meeting" }),
      })
      const { data: activity } = await actRes.json()

      const personRes = await app.request("/people", {
        method: "POST",
        ...json({ firstName: "Test", lastName: "Person" }),
      })
      const { data: person } = await personRes.json()

      return { activity, person }
    }

    it("creates and lists participants", async () => {
      const { activity, person } = await seedActivityAndPerson()

      const createRes = await app.request(`/activities/${activity.id}/participants`, {
        method: "POST",
        ...json({ personId: person.id, isPrimary: true }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.personId).toBe(person.id)
      expect(createBody.data.isPrimary).toBe(true)

      const listRes = await app.request(`/activities/${activity.id}/participants`, {
        method: "GET",
      })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data.length).toBe(1)
    })

    it("deletes a participant", async () => {
      const { activity, person } = await seedActivityAndPerson()

      const createRes = await app.request(`/activities/${activity.id}/participants`, {
        method: "POST",
        ...json({ personId: person.id }),
      })
      const { data: participant } = await createRes.json()

      const res = await app.request(`/activity-participants/${participant.id}`, {
        method: "DELETE",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})
