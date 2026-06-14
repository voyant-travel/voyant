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
 * `@voyant-travel/hono` + the domain modules are available; this pure layer runs
 * with no cross-package wiring.
 */
const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"]
const VALID_CLASSIFICATIONS: ActionClassification[] = [
  "read",
  "routine_write",
  "destructive",
  "requires_confirmation",
]

// Mirrors the canonical API-key scope grammar (`permissionStringPattern` in
// `packages/types/src/api-keys.ts`): a lowercase, hyphen-allowed `resource:action`
// pair — so PII-aware scopes like `bookings-pii:read` are accepted. Descriptors
// always name concrete scopes, so the `*` wildcards the canonical pattern allows
// are intentionally disallowed here (a wildcard in a descriptor is a bug).
const SCOPE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/

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

      // Scopes are a canonical `resource:action` pair (hyphens allowed).
      for (const scope of op.scopes) {
        expect(scope, `${op.id} scope`).toMatch(SCOPE)
      }

      // `path()` must reproduce `pathTemplate` exactly once every `:param` is
      // substituted by a distinct sample value. Comparing the whole built path
      // to the substituted template catches omitted, reordered, AND
      // unsubstituted params — not just a leftover `/:`. (e.g. a `/:id/confirm`
      // template whose builder returns `.../confirm` would slip past a mere
      // "no leftover colon" check but calls the wrong route.)
      const params: Record<string, string> = {}
      const expectedPath = op.pathTemplate
        .split("/")
        .map((seg) => {
          if (!seg.startsWith(":")) return seg
          const name = seg.slice(1)
          params[name] = `sample-${name}`
          return params[name]
        })
        .join("/")
      const built = op.path(params as never)
      expect(built, `${op.id} path() must match its declared template`).toBe(expectedPath)
    }
  })
})
