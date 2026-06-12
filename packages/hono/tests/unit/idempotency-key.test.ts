import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm")
  return {
    ...actual,
    // biome-ignore lint/suspicious/noExplicitAny: structural fake operator
    eq: (column: any, value: unknown) => ({ _op: "eq", _args: [column.__name, value] }),
    // biome-ignore lint/suspicious/noExplicitAny: structural fake operator
    and: (...args: any[]) => ({ _op: "and", _args: args }),
    // biome-ignore lint/suspicious/noExplicitAny: structural fake operator
    lt: (column: any, value: unknown) => ({ _op: "lt", _args: [column.__name, value] }),
  }
})

vi.mock("@voyantjs/db/schema/infra", () => ({
  infraIdempotencyKeysTable: {
    id: { __name: "id" },
    scope: { __name: "scope" },
    key: { __name: "key" },
    bodyHash: { __name: "bodyHash" },
    responseStatus: { __name: "responseStatus" },
    responseBody: { __name: "responseBody" },
    referenceId: { __name: "referenceId" },
    createdAt: { __name: "createdAt" },
    expiresAt: { __name: "expiresAt" },
  },
}))

import { idempotencyKey } from "../../src/middleware/idempotency-key.js"

interface StoredRow {
  scope: string
  key: string
  bodyHash: string
  responseStatus: number
  responseBody: unknown
  referenceId: string | null
  expiresAt: Date
}

/**
 * In-memory drizzle-shaped fake. Implements only the surface idempotencyKey
 * uses: select().from().where().limit(), insert().values().onConflictDoNothing(),
 * delete().where().
 */
function createFakeDb() {
  const rows: StoredRow[] = []

  // biome-ignore lint/suspicious/noExplicitAny: structural fake of drizzle's chain
  function evalWhere(row: StoredRow, predicate: any): boolean {
    if (!predicate) return true
    const op = predicate._op as string | undefined
    if (op === "and") {
      return predicate._args.every((p: unknown) => evalWhere(row, p))
    }
    if (op === "eq") {
      const [columnName, value] = predicate._args
      return (row as unknown as Record<string, unknown>)[columnName] === value
    }
    if (op === "lt") {
      const [columnName, value] = predicate._args
      const v = (row as unknown as Record<string, unknown>)[columnName]
      return (v as Date) < (value as Date)
    }
    return false
  }

  return {
    rows,
    select() {
      return {
        from() {
          return {
            where(predicate: unknown) {
              return {
                limit() {
                  const found = rows.filter((row) => evalWhere(row, predicate))
                  return Promise.resolve(found.slice(0, 1))
                },
              }
            },
          }
        },
      }
    },
    insert() {
      return {
        values(values: Partial<StoredRow>) {
          const row: StoredRow = {
            scope: values.scope ?? "",
            key: values.key ?? "",
            bodyHash: values.bodyHash ?? "",
            responseStatus: values.responseStatus ?? 200,
            responseBody: values.responseBody ?? null,
            referenceId: values.referenceId ?? null,
            expiresAt: values.expiresAt ?? new Date(),
          }
          return {
            onConflictDoNothing() {
              const exists = rows.some(
                (existing) => existing.scope === row.scope && existing.key === row.key,
              )
              if (!exists) rows.push(row)
              return Promise.resolve()
            },
          }
        },
      }
    },
    delete() {
      return {
        where(predicate: unknown) {
          const before = rows.length
          for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i]
            if (row && evalWhere(row, predicate)) {
              rows.splice(i, 1)
            }
          }
          const removed = before - rows.length
          return {
            returning() {
              return Promise.resolve(Array.from({ length: removed }, () => ({})))
            },
          }
        },
      }
    },
  }
}

function buildApp(
  handler: (c: { json: (data: unknown, status?: number) => Response }) => Response,
) {
  const fakeDb = createFakeDb()
  const app = new Hono()
  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: test fake
    c.set("db", fakeDb as any)
    await next()
  })
  app.post("/things", idempotencyKey({ scope: "test" }), (c) => handler(c))
  return { app, fakeDb }
}

async function postJson(
  app: Hono,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return app.request("/things", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("idempotencyKey middleware", () => {
  it("passes through when no header is supplied (default: not required)", async () => {
    const { app, fakeDb } = buildApp((c) => c.json({ id: "x" }, 201))
    const res = await postJson(app, { foo: 1 })
    expect(res.status).toBe(201)
    expect(fakeDb.rows).toHaveLength(0)
  })

  it("rejects with 400 when required and no header is supplied", async () => {
    const fakeDb = createFakeDb()
    const app = new Hono()
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      c.set("db", fakeDb as any)
      await next()
    })
    app.post("/things", idempotencyKey({ scope: "test", required: true }), (c) =>
      c.json({ id: "x" }, 201),
    )
    const res = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("stores the response on first request", async () => {
    const { app, fakeDb } = buildApp((c) => c.json({ id: "book_1" }, 201))
    const res = await postJson(app, { foo: 1 }, { "Idempotency-Key": "k1" })
    expect(res.status).toBe(201)
    expect(res.headers.get("Idempotency-Key")).toBe("k1")
    expect(fakeDb.rows).toHaveLength(1)
    expect(fakeDb.rows[0]?.key).toBe("k1")
    expect(fakeDb.rows[0]?.responseStatus).toBe(201)
    expect(fakeDb.rows[0]?.referenceId).toBe("book_1")
  })

  it("replays the original response when the same key + body is sent again", async () => {
    let calls = 0
    const { app } = buildApp((c) => {
      calls++
      return c.json({ id: `book_${calls}` }, 201)
    })

    const first = await postJson(app, { foo: 1 }, { "Idempotency-Key": "k1" })
    expect(first.status).toBe(201)
    expect(((await first.json()) as { id: string }).id).toBe("book_1")

    const replay = await postJson(app, { foo: 1 }, { "Idempotency-Key": "k1" })
    expect(replay.status).toBe(201)
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
    expect(((await replay.json()) as { id: string }).id).toBe("book_1")
    expect(calls).toBe(1)
  })

  it("returns 409 when the same key replays with a different body", async () => {
    const { app } = buildApp((c) => c.json({ id: "book_1" }, 201))

    await postJson(app, { foo: 1 }, { "Idempotency-Key": "k1" })
    const conflict = await postJson(app, { foo: 2 }, { "Idempotency-Key": "k1" })
    expect(conflict.status).toBe(409)
    const body = (await conflict.json()) as { error: string }
    expect(body.error).toMatch(/different request body/)
  })

  it("returns 409 when fingerprinted query params change under the same key", async () => {
    const fakeDb = createFakeDb()
    const app = new Hono()
    let calls = 0
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      c.set("db", fakeDb as any)
      await next()
    })
    app.post(
      "/things",
      idempotencyKey({ scope: "test", fingerprintSearchParams: ["wait"] }),
      (c) => {
        calls++
        return c.json({ id: `book_${calls}` }, 201)
      },
    )

    const first = await app.request("/things?wait=none", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "k1" },
      body: JSON.stringify({ foo: 1 }),
    })
    expect(first.status).toBe(201)

    const replay = await app.request("/things?wait=none", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "k1" },
      body: JSON.stringify({ foo: 1 }),
    })
    expect(replay.status).toBe(201)
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true")

    const conflict = await app.request("/things?wait=pdf", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "k1" },
      body: JSON.stringify({ foo: 1 }),
    })
    expect(conflict.status).toBe(409)
    expect(calls).toBe(1)
  })

  it("scopes keys per endpoint family — same key on a different scope does not collide", async () => {
    const fakeDb = createFakeDb()
    const app = new Hono()
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      c.set("db", fakeDb as any)
      await next()
    })
    app.post("/a", idempotencyKey({ scope: "scope-a" }), (c) => c.json({ which: "a" }, 201))
    app.post("/b", idempotencyKey({ scope: "scope-b" }), (c) => c.json({ which: "b" }, 201))

    const a = await app.request("/a", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({}),
    })
    expect(a.status).toBe(201)

    const b = await app.request("/b", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({}),
    })
    expect(b.status).toBe(201)

    expect(fakeDb.rows).toHaveLength(2)
  })

  it("scopes keys by caller by default", async () => {
    const fakeDb = createFakeDb()
    const app = new Hono()
    let caller = "user_a"
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      c.set("db", fakeDb as any)
      c.set("userId", caller)
      await next()
    })
    app.post("/things", idempotencyKey({ scope: "test" }), (c) => c.json({ caller }, 201))

    const first = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({ foo: 1 }),
    })
    expect(first.status).toBe(201)

    caller = "user_b"
    const second = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({ foo: 1 }),
    })

    expect(second.headers.get("Idempotency-Replayed")).toBeNull()
    expect(((await second.json()) as { caller: string }).caller).toBe("user_b")
    expect(fakeDb.rows).toHaveLength(2)
  })

  it("does not store responses when replayResponses is disabled", async () => {
    const fakeDb = createFakeDb()
    const app = new Hono()
    let calls = 0
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      c.set("db", fakeDb as any)
      await next()
    })
    app.post("/things", idempotencyKey({ scope: "test", replayResponses: false }), (c) => {
      calls++
      return c.json({ token: `secret_${calls}` }, 201)
    })

    await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({ foo: 1 }),
    })
    const second = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "shared" },
      body: JSON.stringify({ foo: 1 }),
    })

    expect(second.headers.get("Idempotency-Replayed")).toBeNull()
    expect(((await second.json()) as { token: string }).token).toBe("secret_2")
    expect(fakeDb.rows).toHaveLength(0)
  })

  it("does not store responses for non-2xx outcomes", async () => {
    const { app, fakeDb } = buildApp((c) => c.json({ error: "validation" }, 400))
    await postJson(app, { foo: 1 }, { "Idempotency-Key": "k1" })
    expect(fakeDb.rows).toHaveLength(0)
  })

  it("rejects keys longer than 255 chars", async () => {
    const { app } = buildApp((c) => c.json({ id: "x" }, 201))
    const longKey = "x".repeat(256)
    const res = await postJson(app, {}, { "Idempotency-Key": longKey })
    expect(res.status).toBe(400)
  })
})
