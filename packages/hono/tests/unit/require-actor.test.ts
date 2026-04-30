import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { requireActor } from "../../src/middleware/require-actor.js"

function makeApp(
  setVars: (c: {
    // biome-ignore lint/suspicious/noExplicitAny: Hono variable setter
    set: (k: string, v: any) => void
  }) => void,
) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    setVars({ set: (k, v) => c.set(k as never, v) })
    await next()
  })
  return app
}

describe("requireActor", () => {
  it("throws at construction time when no actors are specified", () => {
    expect(() => requireActor()).toThrow(/at least one allowed actor/)
  })

  it("allows a request whose actor is in the allowed list", async () => {
    const app = makeApp((c) => c.set("actor", "staff"))
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(200)
  })

  it("rejects a request whose actor is not allowed", async () => {
    const app = makeApp((c) => c.set("actor", "customer"))
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/Forbidden/)
  })

  it("returns 401 when no actor is set on a staff-only surface", async () => {
    const app = makeApp(() => {
      // do not set actor — auth middleware was missing or misordered
    })
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/Unauthorized/)
  })

  it("401 message points custom-resolver consumers at the missing `actor` field", async () => {
    // Lock in the actionable wording — the previous "actor not resolved" error
    // surfaced as a session bug; the message must call out `auth.resolve` and
    // the `actor` field so the migration path is obvious. See issue #381.
    const app = makeApp(() => {})
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("auth.resolve")
    expect(body.error).toContain("actor")
    expect(body.error).toContain("staff")
  })

  it("returns 401 when no actor is set on a public-only surface", async () => {
    const app = makeApp(() => {
      // do not set actor
    })
    app.use("*", requireActor("customer", "partner"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(401)
  })

  it("differentiates 401 (no actor) from 403 (wrong actor)", async () => {
    const wrongActor = makeApp((c) => c.set("actor", "customer"))
    wrongActor.use("*", requireActor("staff"))
    wrongActor.get("/", (c) => c.json({ ok: true }))
    const wrong = await wrongActor.request("/")
    expect(wrong.status).toBe(403)

    const noActor = makeApp(() => {})
    noActor.use("*", requireActor("staff"))
    noActor.get("/", (c) => c.json({ ok: true }))
    const none = await noActor.request("/")
    expect(none.status).toBe(401)
  })

  it("bypasses the check for internal requests", async () => {
    const app = makeApp((c) => {
      c.set("actor", "customer")
      c.set("isInternalRequest", true)
    })
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(200)
  })

  it("passes through OPTIONS preflight requests", async () => {
    const app = makeApp((c) => c.set("actor", "customer"))
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/", { method: "OPTIONS" })
    // Hono returns 404 for OPTIONS when not explicitly handled,
    // but our middleware must not have blocked with 403
    expect(res.status).not.toBe(403)
  })

  it("supports multiple allowed actors", async () => {
    const app = makeApp((c) => c.set("actor", "partner"))
    app.use("*", requireActor("customer", "partner", "supplier"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(200)
  })
})
