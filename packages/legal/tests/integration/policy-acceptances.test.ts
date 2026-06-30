import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { policiesAdminRoutes } from "../../src/policies/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

async function createPolicy(app: Hono, slug: string) {
  const res = await app.request("/", {
    method: "POST",
    ...json({
      kind: "cancellation",
      name: slug,
      slug,
      language: "en",
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string }
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

async function createAcceptance(app: Hono, policyVersionId: string, personId: string) {
  const res = await app.request("/acceptances", {
    method: "POST",
    ...json({
      policyVersionId,
      personId,
      method: "explicit_checkbox",
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string; policyVersionId: string }
}

describe.skipIf(!DB_AVAILABLE)("Policy acceptances routes", () => {
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

  it("filters acceptances to versions owned by the requested policy", async () => {
    const policy = await createPolicy(app, "acceptance-owner")
    const otherPolicy = await createPolicy(app, "acceptance-other")
    const emptyPolicy = await createPolicy(app, "acceptance-empty")

    const version = await createPolicyVersion(app, policy.id, "Owner terms")
    const otherVersion = await createPolicyVersion(app, otherPolicy.id, "Other terms")

    const acceptance = await createAcceptance(app, version.id, "people_owner")
    await createAcceptance(app, otherVersion.id, "people_other")

    const listed = await app.request(`/acceptances?policyId=${policy.id}`)
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect(listedBody.total).toBe(1)
    expect(listedBody.data).toEqual([expect.objectContaining({ id: acceptance.id })])

    const emptyListed = await app.request(`/acceptances?policyId=${emptyPolicy.id}`)
    expect(emptyListed.status).toBe(200)
    const emptyListedBody = await emptyListed.json()
    expect(emptyListedBody.total).toBe(0)
    expect(emptyListedBody.data).toEqual([])
  })
})
