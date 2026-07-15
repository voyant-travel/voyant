import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { requireActor } from "../../src/middleware/require-actor.js"

function makeApp(
  setVars: (c: {
    // biome-ignore lint/suspicious/noExplicitAny: Hono variable setter -- owner: hono; existing suppression is intentional pending typed cleanup.
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

  it("lets a scoped API key read /v1/admin/_meta/* without a matching module scope", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["bookings:read"]) // no _meta or wildcard scope
    })
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/_meta/capabilities", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/_meta/capabilities")
    expect(res.status).toBe(200)
  })

  it("lets any authenticated API key reach /v1/admin/mcp (per-tool scopes gate inside)", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["catalog:read"]) // no mcp or wildcard scope
    })
    app.use("*", requireActor("staff"))
    app.post("/v1/admin/mcp", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/mcp", { method: "POST" })
    expect(res.status).toBe(200)
  })

  it("still enforces module scopes for an API key on non-_meta admin routes", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["bookings:read"])
    })
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/finance/invoices")
    expect(res.status).toBe(403)
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

  it("does not bypass the check for internal requests without matching actor or scopes", async () => {
    const app = makeApp((c) => {
      c.set("actor", "customer")
      c.set("callerType", "internal")
      c.set("isInternalRequest", true)
    })
    app.use("*", requireActor("staff"))
    app.get("/", (c) => c.json({ ok: true }))

    const res = await app.request("/")
    expect(res.status).toBe(403)
  })

  it("allows internal requests with method-derived resource permission", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "internal")
      c.set("isInternalRequest", true)
      c.set("scopes", ["products:read"])
    })
    app.use("*", requireActor("staff"))
    app.get("/v1/products", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/products")
    expect(res.status).toBe(200)
  })

  it("allows API keys on any surface when the method-derived resource permission is present", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["products:read"])
    })
    app.use("*", requireActor("customer", "partner", "supplier"))
    app.get("/v1/public/products", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/public/products")
    expect(res.status).toBe(200)
  })

  it("strips basePath before checking API key route resource permissions", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["products:read"])
    })
    app.use("*", requireActor({ basePath: "/api" }, "customer", "partner", "supplier"))
    app.get("/api/v1/public/products", (c) => c.json({ ok: true }))

    const res = await app.request("/api/v1/public/products")
    expect(res.status).toBe(200)
  })

  it("rejects API keys on actor surfaces when the resource permission is missing", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["bookings:read"])
    })
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/products", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/products")
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/required permission/)
  })

  it("applies API key permissions to the route resource prefix only", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["products:read"])
    })
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/products/:id/media", (c) => c.json({ ok: true }))
    app.get("/v1/admin/bookings/:id", (c) => c.json({ ok: true }))

    const products = await app.request("/v1/admin/products/prod_1/media")
    const bookings = await app.request("/v1/admin/bookings/book_1")

    expect(products.status).toBe(200)
    expect(bookings.status).toBe(403)
  })

  it("uses a selected graph resource override before the path segment", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["bookings:read"])
    })
    app.use(
      "*",
      requireActor(
        { resources: [{ path: "/v1/admin/person-bookings", resource: "bookings" }] },
        "staff",
      ),
    )
    app.get("/v1/admin/person-bookings/:personId", (c) => c.json({ ok: true }))

    expect((await app.request("/v1/admin/person-bookings/person_1")).status).toBe(200)
  })

  it("delegates coarse capability checks for route-authorized graph mounts", async () => {
    const app = makeApp((c) => {
      c.set("actor", "staff")
      c.set("callerType", "session")
      c.set("scopes", ["bookings:read"])
    })
    app.use(
      "*",
      requireActor(
        {
          resources: [
            {
              path: "/v1/admin/navigation-preferences",
              resource: "admin-navigation",
              authorization: "route",
            },
          ],
        },
        "staff",
      ),
    )
    app.put("/v1/admin/navigation-preferences/me", (c) => c.json({ ok: true }))

    const response = await app.request("/v1/admin/navigation-preferences/me", { method: "PUT" })
    expect(response.status).toBe(200)
  })

  it("keeps path-derived authorization when no graph override matches", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["products:read"])
    })
    app.use(
      "*",
      requireActor(
        { resources: [{ path: "/v1/admin/person-bookings", resource: "bookings" }] },
        "staff",
      ),
    )
    app.get("/v1/admin/products", (c) => c.json({ ok: true }))

    expect((await app.request("/v1/admin/products")).status).toBe(200)
  })

  it("allows workflow trigger and webhook relay API key permissions on POST routes", async () => {
    const app = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["workflows:trigger", "webhooks:relay"])
    })
    app.use("*", requireActor("staff"))
    app.post("/v1/admin/workflows/events", (c) => c.json({ ok: true }))
    app.post("/v1/admin/webhooks/relay", (c) => c.json({ ok: true }))

    const workflow = await app.request("/v1/admin/workflows/events", { method: "POST" })
    const webhook = await app.request("/v1/admin/webhooks/relay", { method: "POST" })
    expect(workflow.status).toBe(200)
    expect(webhook.status).toBe(200)
  })

  it("honors the search action on a POST /search endpoint (voyant#2649)", async () => {
    // Catalog search is exposed as POST (complex body) but is a read-family
    // operation, so a `catalog:search`/`catalog:read` token must reach it.
    const searchToken = () =>
      makeApp((c) => {
        c.set("callerType", "api_key")
        c.set("scopes", ["catalog:read", "catalog:search"])
      })

    const admin = searchToken()
    admin.use("*", requireActor("staff"))
    admin.post("/v1/admin/catalog/search", (c) => c.json({ ok: true }))
    expect((await admin.request("/v1/admin/catalog/search", { method: "POST" })).status).toBe(200)

    const publicApp = searchToken()
    publicApp.use("*", requireActor("customer", "partner", "supplier"))
    publicApp.post("/v1/public/catalog/search", (c) => c.json({ ok: true }))
    expect((await publicApp.request("/v1/public/catalog/search", { method: "POST" })).status).toBe(
      200,
    )

    // A bare `catalog:search` scope alone is sufficient.
    const searchOnly = makeApp((c) => {
      c.set("callerType", "api_key")
      c.set("scopes", ["catalog:search"])
    })
    searchOnly.use("*", requireActor("staff"))
    searchOnly.post("/v1/admin/catalog/search", (c) => c.json({ ok: true }))
    // Hyphenated search endpoints (e.g. POST /catalog/package-search) count too.
    searchOnly.post("/v1/admin/catalog/package-search", (c) => c.json({ ok: true }))
    expect((await searchOnly.request("/v1/admin/catalog/search", { method: "POST" })).status).toBe(
      200,
    )
    expect(
      (await searchOnly.request("/v1/admin/catalog/package-search", { method: "POST" })).status,
    ).toBe(200)
  })

  it("still gates non-search POST routes for a search/read-only token (voyant#2649)", async () => {
    // The search relaxation must not leak into write routes.
    const build = () => {
      const app = makeApp((c) => {
        c.set("callerType", "api_key")
        c.set("scopes", ["catalog:read", "catalog:search", "products:read"])
      })
      app.use("*", requireActor("staff"))
      app.post("/v1/admin/products", (c) => c.json({ ok: true }))
      app.post("/v1/admin/bookings", (c) => c.json({ ok: true }))
      // A write route whose name merely contains "search" must stay gated.
      app.post("/v1/admin/products/searchable", (c) => c.json({ ok: true }))
      return app
    }

    expect((await build().request("/v1/admin/products", { method: "POST" })).status).toBe(403)
    expect((await build().request("/v1/admin/bookings", { method: "POST" })).status).toBe(403)
    expect(
      (await build().request("/v1/admin/products/searchable", { method: "POST" })).status,
    ).toBe(403)
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

describe("requireActor — staff session RBAC scopes (voyant#2085)", () => {
  const OFF = { VOYANT_RBAC_ENFORCE: "0" }

  function staffSession(scopes: string[]) {
    return makeApp((c) => {
      c.set("actor", "staff")
      c.set("callerType", "session")
      c.set("scopes", scopes)
    })
  }

  it("enforces staff scopes by default (no env)", async () => {
    const app = staffSession(["bookings:read"])
    app.use("*", requireActor("staff"))
    app.post("/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    // Default-on: a member without finance:write is denied.
    expect((await app.request("/v1/admin/finance/invoices", { method: "POST" })).status).toBe(403)
  })

  it("can be disabled with the VOYANT_RBAC_ENFORCE kill switch", async () => {
    const app = staffSession(["bookings:read"])
    app.use("*", requireActor("staff"))
    app.post("/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    expect((await app.request("/v1/admin/finance/invoices", { method: "POST" }, OFF)).status).toBe(
      200,
    )
  })

  it("lets a full-access (`*`) member through any admin route", async () => {
    const app = staffSession(["*"])
    app.use("*", requireActor("staff"))
    app.post("/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/finance/invoices", { method: "POST" })
    expect(res.status).toBe(200)
  })

  it("allows a read but denies a write when the member only has :read", async () => {
    const build = () => {
      const app = staffSession(["bookings:read"])
      app.use("*", requireActor("staff"))
      app.get("/v1/admin/bookings", (c) => c.json({ ok: true }))
      app.post("/v1/admin/bookings", (c) => c.json({ ok: true }))
      return app
    }

    expect((await build().request("/v1/admin/bookings")).status).toBe(200)
    expect((await build().request("/v1/admin/bookings", { method: "POST" })).status).toBe(403)
  })

  it("denies a module the member has no scope for", async () => {
    const app = staffSession(["bookings:read", "bookings:write"])
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/admin/finance/invoices")
    expect(res.status).toBe(403)
  })

  it("strips basePath before enforcing staff session RBAC scopes", async () => {
    const app = staffSession(["bookings:read", "bookings:write"])
    app.use("*", requireActor({ basePath: "/api" }, "staff"))
    app.get("/api/v1/admin/finance/invoices", (c) => c.json({ ok: true }))

    const res = await app.request("/api/v1/admin/finance/invoices")
    expect(res.status).toBe(403)
  })

  it("gates team management on the team scope", async () => {
    const denied = staffSession(["bookings:read", "bookings:write"]) // editor-ish, no team
    denied.use("*", requireActor("staff"))
    denied.post("/v1/admin/team/members/m_1/permissions", (c) => c.json({ ok: true }))
    expect(
      (await denied.request("/v1/admin/team/members/m_1/permissions", { method: "POST" })).status,
    ).toBe(403)

    const allowed = staffSession(["team:write"])
    allowed.use("*", requireActor("staff"))
    allowed.post("/v1/admin/team/members/m_1/permissions", (c) => c.json({ ok: true }))
    expect(
      (await allowed.request("/v1/admin/team/members/m_1/permissions", { method: "POST" })).status,
    ).toBe(200)
  })

  it("still lets a restricted member read _meta", async () => {
    const app = staffSession(["bookings:read"])
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/_meta/capabilities", (c) => c.json({ ok: true }))

    expect((await app.request("/v1/admin/_meta/capabilities")).status).toBe(200)
  })

  it("denies a member with no scopes at all", async () => {
    const app = staffSession([])
    app.use("*", requireActor("staff"))
    app.get("/v1/admin/bookings", (c) => c.json({ ok: true }))

    expect((await app.request("/v1/admin/bookings")).status).toBe(403)
  })
})
