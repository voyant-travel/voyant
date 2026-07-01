import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { policiesAdminRoutes } from "../../src/policies/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

async function createPolicy(app: Hono, slug: string, language = "en") {
  const res = await app.request("/", {
    method: "POST",
    ...json({
      kind: "cancellation",
      name: slug,
      slug,
      language,
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string; language: string }
}

async function createPolicyVersion(app: Hono, policyId: string, title: string) {
  const res = await app.request(`/${policyId}/versions`, {
    method: "POST",
    ...json({
      title,
      body: `${title} body`,
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string }
}

describe.skipIf(!DB_AVAILABLE)("Legal policy admin routes", () => {
  let app: Hono
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    app.route("/", policiesAdminRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("preserves policy language when PATCH omits language", async () => {
    const policy = await createPolicy(app, "partial-policy-ro", "ro")

    const res = await app.request(`/${policy.id}`, {
      method: "PATCH",
      ...json({ description: "Descriere actualizata" }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(
      expect.objectContaining({
        description: "Descriere actualizata",
        language: "ro",
      }),
    )
  })

  it("preserves policy rule sort order when PATCH omits sortOrder", async () => {
    const policy = await createPolicy(app, "partial-rule-sort")
    const version = await createPolicyVersion(app, policy.id, "Cancellation")
    const created = await app.request(`/versions/${version.id}/rules`, {
      method: "POST",
      ...json({
        ruleType: "window",
        label: "Original",
        sortOrder: 3,
      }),
    })
    expect(created.status).toBe(201)
    const rule = (await created.json()).data as { id: string }

    const res = await app.request(`/rules/${rule.id}`, {
      method: "PATCH",
      ...json({ label: "Updated" }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(
      expect.objectContaining({
        label: "Updated",
        sortOrder: 3,
      }),
    )
  })

  it("returns 409 instead of deleting a policy with recorded acceptances", async () => {
    const policy = await createPolicy(app, "policy-with-acceptance")
    const version = await createPolicyVersion(app, policy.id, "Accepted terms")
    const acceptance = await app.request("/acceptances", {
      method: "POST",
      ...json({
        policyVersionId: version.id,
        personId: "people_policy_delete_conflict",
        method: "explicit_checkbox",
      }),
    })
    expect(acceptance.status).toBe(201)

    const res = await app.request(`/${policy.id}`, { method: "DELETE" })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Policy has recorded acceptances and cannot be deleted",
    })
  })
})
