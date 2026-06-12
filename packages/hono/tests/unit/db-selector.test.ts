import { VOYANT_DB_SUPPORTS_TRANSACTIONS } from "@voyantjs/db/transaction-capability"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createPathDbSelector } from "../../src/lib/db-selector.js"
import { db } from "../../src/middleware/db.js"
import type { DbFactory, VoyantDb } from "../../src/types.js"

function fakeDb(supportsTransactions: boolean): VoyantDb {
  const handle: Record<PropertyKey, unknown> = {
    [VOYANT_DB_SUPPORTS_TRANSACTIONS]: supportsTransactions,
  }
  return handle as unknown as VoyantDb
}

describe("createPathDbSelector", () => {
  const defaultFactory = (() => fakeDb(false)) as DbFactory
  const transactionalFactory = (() => fakeDb(true)) as DbFactory
  const selector = createPathDbSelector({
    defaultFactory,
    transactionalFactory,
    transactionalPrefixes: ["/v1/admin/bookings", "/v1/public/catalog/book"],
  })

  it("routes exact and nested paths under a transactional prefix", () => {
    expect(selector.select("/v1/admin/bookings").factory).toBe(transactionalFactory)
    expect(selector.select("/v1/admin/bookings/bk_1/confirm").factory).toBe(transactionalFactory)
    expect(selector.select("/v1/public/catalog/book").factory).toBe(transactionalFactory)
    expect(selector.select("/v1/admin/bookings").mustSupportTransactions).toBe(true)
  })

  it("does NOT match sibling segments sharing the prefix string", () => {
    expect(selector.select("/v1/admin/bookings-export").factory).toBe(defaultFactory)
    expect(selector.select("/v1/public/catalog/bookmarks").factory).toBe(defaultFactory)
  })

  it("routes everything else to the default factory", () => {
    const selection = selector.select("/v1/public/products")
    expect(selection.factory).toBe(defaultFactory)
    expect(selection.mustSupportTransactions).toBe(false)
  })
})

describe("db middleware with a selector", () => {
  function buildApp(opts: { requiresTransactionalDb: string[] }) {
    const defaultFactory = vi.fn(() => fakeDb(false))
    const transactionalFactory = vi.fn(() => fakeDb(true))
    const selector = createPathDbSelector({
      defaultFactory: defaultFactory as unknown as DbFactory,
      transactionalFactory: transactionalFactory as unknown as DbFactory,
      transactionalPrefixes: ["/v1/admin/bookings"],
    })
    const app = new Hono()
    app.onError((err, c) => c.json({ error: err.message }, 500))
    // biome-ignore lint/suspicious/noExplicitAny: simplified bindings for the test
    app.use("*", db(selector as any, opts))
    app.get("/v1/admin/bookings/list", (c) => c.json({ ok: true }))
    app.get("/v1/public/products", (c) => c.json({ ok: true }))
    return { app, defaultFactory, transactionalFactory }
  }

  it("serves transactional surfaces with the transactional factory", async () => {
    const { app, defaultFactory, transactionalFactory } = buildApp({
      requiresTransactionalDb: ["bookings"],
    })

    const res = await app.request("/v1/admin/bookings/list")

    expect(res.status).toBe(200)
    expect(transactionalFactory).toHaveBeenCalledOnce()
    expect(defaultFactory).not.toHaveBeenCalled()
  })

  it("serves other surfaces with the default factory and skips the tx assertion", async () => {
    const { app, defaultFactory, transactionalFactory } = buildApp({
      requiresTransactionalDb: ["bookings"],
    })

    // The default factory is transaction-INCAPABLE (neon-http) — with a
    // selector that must not trip the requiresTransactionalDb assertion
    // on non-transactional surfaces.
    const res = await app.request("/v1/public/products")

    expect(res.status).toBe(200)
    expect(defaultFactory).toHaveBeenCalledOnce()
    expect(transactionalFactory).not.toHaveBeenCalled()
  })

  it("still throws when a transactional surface resolves a non-capable client", async () => {
    const incapable = vi.fn(() => fakeDb(false))
    const selector = createPathDbSelector({
      defaultFactory: incapable as unknown as DbFactory,
      transactionalFactory: incapable as unknown as DbFactory,
      transactionalPrefixes: ["/v1/admin/bookings"],
    })
    const app = new Hono()
    app.onError((err, c) => c.json({ error: err.message }, 500))
    // biome-ignore lint/suspicious/noExplicitAny: simplified bindings for the test
    app.use("*", db(selector as any, { requiresTransactionalDb: ["bookings"] }))
    app.get("/v1/admin/bookings/list", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/bookings/list")

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("bookings")
    expect(body.error).toContain("transactions")
  })
})
