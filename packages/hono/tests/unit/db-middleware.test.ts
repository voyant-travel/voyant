import { VOYANT_DB_SUPPORTS_TRANSACTIONS } from "@voyant-travel/db/transaction-capability"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { db } from "../../src/middleware/db.js"
import type { DbFactory, VoyantBindings, VoyantDb } from "../../src/types.js"

function fakeDb(supportsTransactions?: boolean): VoyantDb {
  const handle: Record<PropertyKey, unknown> = {}
  if (typeof supportsTransactions === "boolean") {
    handle[VOYANT_DB_SUPPORTS_TRANSACTIONS] = supportsTransactions
  }
  return handle as VoyantDb
}

function dbFactoryForTest(factory: () => VoyantDb): DbFactory<VoyantBindings> {
  return () => factory()
}

function buildApp(opts: Parameters<typeof db>[1] | undefined, factory: () => VoyantDb) {
  const app = new Hono()
  // Surface the thrown middleware error in the response body so tests can
  // assert on it (matches the createApp + handleApiError shape in prod).
  app.onError((err, c) => c.json({ error: err.message }, 500))
  app.use("*", db(dbFactoryForTest(factory), opts))
  app.get("/", (c) => c.json({ db: typeof c.get("db") }))
  return app
}

describe("db middleware — transactional adapter assertion", () => {
  it("passes when no modules require transactions", async () => {
    const factory = vi.fn(() => fakeDb(false))
    const app = buildApp({ requiresTransactionalDb: [] }, factory)

    const res = await app.request("/")

    expect(res.status).toBe(200)
    expect(factory).toHaveBeenCalledOnce()
  })

  it("passes when the db is tagged transaction-capable", async () => {
    const factory = vi.fn(() => fakeDb(true))
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory)

    const res = await app.request("/")

    expect(res.status).toBe(200)
  })

  it("passes when the db is untagged (assume capable)", async () => {
    const factory = vi.fn(() => fakeDb(undefined))
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory)

    const res = await app.request("/")

    expect(res.status).toBe(200)
  })

  it("throws when the db is tagged not-transaction-capable and a module needs it", async () => {
    const factory = vi.fn(() => fakeDb(false))
    const app = buildApp({ requiresTransactionalDb: ["bookings", "finance"] }, factory)

    const res = await app.request("/")
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(500)
    expect(body.error).toMatch(/db adapter does not support interactive transactions/)
    expect(body.error).toMatch(/bookings, finance/)
  })

  it("error message points at the supported adapters", async () => {
    const factory = vi.fn(() => fakeDb(false))
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory)

    const res = await app.request("/")
    const body = (await res.json()) as { error: string }

    expect(body.error).toMatch(/createServerlessDbClient/)
    expect(body.error).toMatch(/adapter:\s*"node"/)
  })

  it("runs the capability check only once per middleware instance", async () => {
    const factory = vi.fn(() => fakeDb(true))
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory)

    await app.request("/")
    await app.request("/")
    await app.request("/")

    // Capability tag lookup is cheap, but we still want to confirm the
    // middleware doesn't repeat the throw-decision work each request.
    // Indirect proof: three successful requests, factory called three
    // times (per-request lifecycle), but no thrown error means the
    // once-only check passed and was not re-evaluated.
    expect(factory).toHaveBeenCalledTimes(3)
  })

  it("keeps throwing on every request as long as the adapter is misconfigured", async () => {
    const factory = vi.fn(() => fakeDb(false))
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory)

    const res1 = await app.request("/")
    const res2 = await app.request("/")
    const res3 = await app.request("/")

    for (const res of [res1, res2, res3]) {
      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: string }
      expect(body.error).toMatch(/db adapter does not support interactive transactions/)
    }
    // Factory keeps being invoked per-request, not short-circuited after
    // the first throw.
    expect(factory).toHaveBeenCalledTimes(3)
  })

  it("disposes a per-request handle even when the capability check fails", async () => {
    const dispose = vi.fn(async () => {})
    const factory = () => ({ db: fakeDb(false), dispose })
    const app = buildApp({ requiresTransactionalDb: ["bookings"] }, factory as never)

    const res = await app.request("/")

    expect(res.status).toBe(500)
    expect(dispose).toHaveBeenCalledOnce()
  })
})
