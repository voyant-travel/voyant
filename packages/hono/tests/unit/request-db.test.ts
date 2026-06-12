import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { requireAuth } from "../../src/middleware/auth.js"
import { db } from "../../src/middleware/db.js"
import { acquireRequestDb } from "../../src/middleware/request-db.js"
import type { DisposableDb, VoyantDb } from "../../src/types.js"

function fakeDisposable(): DisposableDb & { disposeSpy: ReturnType<typeof vi.fn> } {
  const disposeSpy = vi.fn(async () => {})
  return {
    db: {} as unknown as VoyantDb,
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
  it("an authenticated (auth.resolve) request opens exactly one client", async () => {
    const handle = fakeDisposable()
    const factory = vi.fn(() => handle)
    const seen: VoyantDb[] = []

    const app = new Hono()
    app.use(
      "*",
      // biome-ignore lint/suspicious/noExplicitAny: simplified bindings for the test
      requireAuth(factory as any, {
        auth: {
          resolve: async ({ db: resolveDb }) => {
            seen.push(resolveDb)
            return { userId: "user_1", actor: "staff" as const }
          },
        },
      }),
    )
    // biome-ignore lint/suspicious/noExplicitAny: simplified bindings for the test
    app.use("*", db(factory as any))
    app.get("/v1/admin/things", (c) => {
      seen.push(c.get("db") as VoyantDb)
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
    // Outside Workers (no executionCtx) the creator disposes inline after
    // the downstream pipeline completes.
    expect(handle.disposeSpy).toHaveBeenCalledOnce()
  })
})
