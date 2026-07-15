import { VOYANT_DB_SUPPORTS_TRANSACTIONS } from "@voyant-travel/db/transaction-capability"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { mountApp } from "../../src/app.js"
import type { ApiModule } from "../../src/module.js"
import type { DbFactory, VoyantBindings, VoyantDb } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }
const TEST_CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for tests.
} as any

function fakeDb(supportsTransactions: boolean): VoyantDb {
  const handle: Record<PropertyKey, unknown> = {
    [VOYANT_DB_SUPPORTS_TRANSACTIONS]: supportsTransactions,
  }
  return handle as VoyantDb
}

describe("mountApp — module transactionalPaths (ADR-0008)", () => {
  function build() {
    const defaultFactory = vi.fn<DbFactory>(() => fakeDb(false))
    const transactionalFactory = vi.fn<DbFactory>(() => fakeDb(true))
    // Declares ONE absolute transactional path — a subset of its routes, mounted
    // outside the name-based surface (no `requiresTransactionalDb` flag).
    const widget: ApiModule = {
      module: { name: "widget" },
      adminRoutes: new Hono()
        .post("/commit", (c) => c.json({ ok: true }))
        .get("/read", (c) => c.json({ ok: true })),
      transactionalPaths: ["/v1/admin/widget/commit"],
    }
    const app = mountApp({
      db: defaultFactory,
      dbTransactional: transactionalFactory,
      modules: [widget],
      auth: { resolve: () => ({ userId: "u", actor: "staff" }) },
    })
    return { app, defaultFactory, transactionalFactory }
  }

  it("routes a declared transactional path to the transactional client", async () => {
    const { app, transactionalFactory } = build()
    const res = await app.request("/v1/admin/widget/commit", { method: "POST" }, TEST_ENV, TEST_CTX)
    expect(res.status).toBe(200)
    expect(transactionalFactory).toHaveBeenCalled()
  })

  it("routes a sibling, non-declared path to the default client", async () => {
    const { app, defaultFactory, transactionalFactory } = build()
    const res = await app.request("/v1/admin/widget/read", {}, TEST_ENV, TEST_CTX)
    expect(res.status).toBe(200)
    expect(defaultFactory).toHaveBeenCalled()
    expect(transactionalFactory).not.toHaveBeenCalled()
  })
})
