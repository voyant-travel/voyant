import { composeFromManifest } from "@voyant-travel/hono/composition"
import { describe, expect, it } from "vitest"
import { frameworkComposition } from "./composition-lazy.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

// biome-ignore lint/suspicious/noExplicitAny: coercion-safe provider stub -- owner: framework composition.
const deepStub: any = new Proxy(() => deepStub, {
  get: (_t, p) => {
    if (p === Symbol.toPrimitive) return () => "stub"
    if (p === "then") return undefined
    return deepStub
  },
  apply: () => deepStub,
})

/**
 * The standard set's transactional surface (ADR-0008) — declared on the routes
 * that own it, so the deployment carries no `dbTransactionalPaths`. Snapshots
 * which standard modules transact (name-based `requiresTransactionalDb`) and the
 * absolute prefixes a lazy family declares (`transactionalPaths`).
 */
describe("standard transactional surface (ADR-0008)", () => {
  const { modules } = composeFromManifest(
    {
      modules: [...FRAMEWORK_RUNTIME_MANIFEST.modules],
      extensions: [...FRAMEWORK_RUNTIME_MANIFEST.extensions],
    },
    frameworkComposition,
    deepStub,
  )

  it("trips transacts via the name-based flag", () => {
    const trips = modules.find((m) => m.module.name === "trips")
    expect(trips?.module.requiresTransactionalDb).toBe(true)
  })

  it("accommodations transacts (room-block pickup/release counters)", () => {
    const accommodations = modules.find((m) => m.module.name === "accommodations")
    expect(accommodations?.module.requiresTransactionalDb).toBe(true)
  })

  it("the catalog booking engine declares its transactional path subset", () => {
    const catalogBooking = modules.find((m) => m.module.name === "catalog-booking")
    expect([...(catalogBooking?.transactionalPaths ?? [])]).toEqual([
      "/v1/admin/catalog/quote",
      "/v1/admin/catalog/quotes/batch",
      "/v1/admin/catalog/book",
      "/v1/admin/catalog/holds",
      "/v1/admin/catalog/orders",
      "/v1/public/catalog/quote",
      "/v1/public/catalog/quotes/batch",
      "/v1/public/catalog/book",
      "/v1/public/catalog/holds",
    ])
  })
})
