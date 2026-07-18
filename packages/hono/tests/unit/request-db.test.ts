import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { requireAuth } from "../../src/middleware/auth.js"
import { db } from "../../src/middleware/db.js"
import { acquireRequestDb } from "../../src/middleware/request-db.js"
import type {
  DbFactory,
  DbFactorySelector,
  DisposableDb,
  VoyantBindings,
  VoyantDb,
} from "../../src/types.js"

function fakeDisposable(): DisposableDb & { disposeSpy: ReturnType<typeof vi.fn> } {
  const disposeSpy = vi.fn(async () => {})
  return {
    db: {} as VoyantDb,
    dispose: disposeSpy,
    disposeSpy,
  }
}

function stubContext(env: Record<string, unknown> = {}) {
  return {
    req: { raw: new Request("http://test.local/") },
    env: env as never,
  }
}

function dbFactoryForTest(factory: () => VoyantDb | DisposableDb): DbFactory<VoyantBindings> {
  return () => factory()
}

describe("acquireRequestDb — per-request client sharing", () => {
  it("creates the client once and returns the same db for later acquisitions", () => {
    const handle = fakeDisposable()
    const factory = vi.fn(() => handle)
    const c = stubContext()

    const first = acquireRequestDb(c, factory as never)
    const second = acquireRequestDb(c, factory as never)

    expect(factory).toHaveBeenCalledOnce()
    expect(first.db).toBe(second.db)
    expect(first.isCreator).toBe(true)
    expect(second.isCreator).toBe(false)
  })

  it("only the creating lease disposes; reuse releases are no-ops", async () => {
    const handle = fakeDisposable()
    const factory = vi.fn(() => handle)
    const c = stubContext()

    const creator = acquireRequestDb(c, factory as never)
    const reuse = acquireRequestDb(c, factory as never)

    await reuse.release()
    expect(handle.disposeSpy).not.toHaveBeenCalled()

    await creator.release()
    expect(handle.disposeSpy).toHaveBeenCalledOnce()

    // Idempotent
    await creator.release()
    expect(handle.disposeSpy).toHaveBeenCalledOnce()
  })

  it("creates a fresh client when the previous one was already released", async () => {
    const factory = vi.fn(() => fakeDisposable())
    const c = stubContext()

    const first = acquireRequestDb(c, factory as never)
    await first.release()
    const second = acquireRequestDb(c, factory as never)

    expect(factory).toHaveBeenCalledTimes(2)
    expect(second.isCreator).toBe(true)
  })

  it("keeps clients separate across different requests", () => {
    const factory = vi.fn(() => fakeDisposable())

    acquireRequestDb(stubContext(), factory as never)
    acquireRequestDb(stubContext(), factory as never)

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it("keeps clients separate per factory within one request", () => {
    const factoryA = vi.fn(() => fakeDisposable())
    const factoryB = vi.fn(() => fakeDisposable())
    const c = stubContext()

    const a = acquireRequestDb(c, factoryA as never)
    const b = acquireRequestDb(c, factoryB as never)

    expect(a.db).not.toBe(b.db)
    expect(a.isCreator).toBe(true)
    expect(b.isCreator).toBe(true)
  })
})

describe("auth + db middleware — single shared client per request", () => {
  it("selects path-based db surfaces after stripping a configured base path", async () => {
    const handle = fakeDisposable()
    const factory = vi.fn(() => handle)
    const selector: DbFactorySelector<VoyantBindings> = {
      select: vi.fn(() => ({
        factory: dbFactoryForTest(factory),
        mustSupportTransactions: false,
      })),
    }

    const app = new Hono()
    app.use("*", db(selector, { basePath: "/api" }))
    app.get("/api/v1/admin/trips/:id", (c) => c.json({ hasDb: Boolean(c.get("db")) }))

    const res = await app.request(
      "/api/v1/admin/trips/trip_123",
      {},
      { DATABASE_URL: "postgres://localhost/test" },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hasDb: true })
    expect(selector.select).toHaveBeenCalledWith("/v1/admin/trips/trip_123")
    expect(factory).toHaveBeenCalledOnce()
  })

  it("an authenticated (auth.resolve) request opens exactly one client", async () => {
    const handle = fakeDisposable()
    const factory = vi.fn(() => handle)
    const dbFactory = dbFactoryForTest(factory)
    const seen: VoyantDb[] = []

    const app = new Hono()
    app.use(
      "*",
      requireAuth(dbFactory, {
        auth: {
          resolve: async ({ db: resolveDb }) => {
            seen.push(resolveDb)
            return { userId: "user_1", actor: "staff" as const, realm: "admin" as const }
          },
        },
      }),
    )
    app.use("*", db(dbFactory))
    let disposedBeforeHandlerFinished = false
    app.get("/v1/admin/things", async (c) => {
      seen.push(c.get("db") as VoyantDb)
      // Yield the event loop mid-handler: if any upstream middleware
      // released the shared lease on `return next()` (without await),
      // the dispose fires during this gap — the route would then be
      // querying a closed pool. Regression guard for the
      // try{return next()}finally{release()} footgun.
      await new Promise((resolve) => setTimeout(resolve, 5))
      disposedBeforeHandlerFinished = handle.disposeSpy.mock.calls.length > 0
      return c.json({ ok: true })
    })

    const res = await app.request(
      "/v1/admin/things",
      { headers: { cookie: "session=abc" } },
      { DATABASE_URL: "postgres://localhost/test" },
    )

    expect(res.status).toBe(200)
    expect(factory).toHaveBeenCalledOnce()
    expect(seen[0]).toBe(seen[1])
    expect(disposedBeforeHandlerFinished).toBe(false)
    // Outside Workers (no executionCtx) the creator disposes inline after
    // the downstream pipeline completes.
    expect(handle.disposeSpy).toHaveBeenCalledOnce()
  })
})
