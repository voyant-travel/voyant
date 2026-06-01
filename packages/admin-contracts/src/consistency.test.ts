import { describe, expect, it } from "vitest"

import { type ActionClassification, allOperations, type HttpMethod } from "./index.js"

/**
 * Descriptor drift guard. Asserts every admin operation descriptor is
 * well-formed and internally consistent — catching the authoring mistakes that
 * make a descriptor diverge from the API surface (bad path, wrong module
 * segment, malformed scope, unsubstituted param).
 *
 * The complementary route-EXISTENCE check (every descriptor resolves to a
 * mounted admin route on a live app) belongs in a deployment test where
 * `@voyantjs/hono` + the domain modules are available; this pure layer runs
 * with no cross-package wiring.
 */
const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"]
const VALID_CLASSIFICATIONS: ActionClassification[] = [
  "read",
  "routine_write",
  "destructive",
  "requires_confirmation",
]

describe("admin-contracts descriptor consistency", () => {
  it("has unique operation ids", () => {
    const ids = allOperations.map((op) => op.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every descriptor is well-formed and internally consistent", () => {
    for (const op of allOperations) {
      // Admin surface path.
      expect(op.pathTemplate, op.id).toMatch(/^\/v1\/admin\//)

      // The path's module segment matches the operation id's domain prefix
      // (e.g. `finance.invoices.list` → `/v1/admin/finance/...`).
      const domain = op.id.split(".")[0]
      expect(op.pathTemplate.startsWith(`/v1/admin/${domain}`), op.id).toBe(true)

      // Valid method + classification.
      expect(VALID_METHODS, op.id).toContain(op.method)
      expect(VALID_CLASSIFICATIONS, op.id).toContain(op.classification)

      // Scopes are `resource:action`.
      for (const scope of op.scopes) {
        expect(scope, `${op.id} scope`).toMatch(/^[a-z_]+:[a-z_]+$/)
      }

      // `path()` substitutes every `:param` from the template and leaves no
      // unresolved params — so the descriptor's path builder matches its
      // declared template shape.
      const params: Record<string, string> = {}
      for (const seg of op.pathTemplate.split("/")) {
        if (seg.startsWith(":")) params[seg.slice(1)] = "sample"
      }
      const built = op.path(params as never)
      expect(built.startsWith("/v1/admin/"), op.id).toBe(true)
      expect(built.includes("/:"), `${op.id} has an unsubstituted param`).toBe(false)
    }
  })
})
