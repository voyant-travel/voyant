import { assembleAnonymousPaths } from "@voyant-travel/hono"
import { composeFromManifest } from "@voyant-travel/hono/composition"
import { describe, expect, it } from "vitest"
import { frameworkComposition } from "./composition.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

/**
 * Recursive, coercion-safe stub for the provider container: any access/call
 * returns itself and primitive coercion yields a string, so every standard
 * factory runs far enough to return its module/extension metadata without real
 * providers wired.
 */
// biome-ignore lint/suspicious/noExplicitAny: test stub for the typed provider container.
const deepStub: any = new Proxy(() => deepStub, {
  get: (_t, p) => {
    if (p === Symbol.toPrimitive) return () => "stub"
    if (p === "then") return undefined
    return deepStub
  },
  apply: () => deepStub,
})

describe("standard anonymous surface (ADR-0008)", () => {
  it("assembles exactly the declared anonymous paths from the standard set", () => {
    const { modules, extensions } = composeFromManifest(
      {
        modules: [...FRAMEWORK_RUNTIME_MANIFEST.modules],
        extensions: [...FRAMEWORK_RUNTIME_MANIFEST.extensions],
      },
      frameworkComposition,
      deepStub,
    )

    // No explicit escape-hatch paths here — this asserts ONLY what the
    // framework's `anonymous` declarations produce. The operator adds its
    // deployment-local (invitations, cruises) + bundle/webhook escape-hatch
    // entries on top; see the operator's app.ts.
    const paths = assembleAnonymousPaths(modules, extensions)

    // Migrated in ADR-0008 Phase 1. Anything not yet declared (e.g. products,
    // payment-link, operator-profile, payment-policy) stays in the operator's
    // explicit `publicPaths` until its follow-up migration — so this snapshot is
    // the full, reviewable record of the framework-declared anonymous surface.
    expect(paths).toEqual([
      "/v1/public/bookings",
      "/v1/public/catalog",
      "/v1/public/customer-portal/contact-exists",
      "/v1/public/documents",
      "/v1/public/finance/accountant",
      "/v1/public/finance/bookings",
      "/v1/public/finance/collections",
      "/v1/public/finance/payment-sessions",
      "/v1/public/finance/vouchers",
      "/v1/public/leads",
      "/v1/public/legal",
      "/v1/public/markets",
      "/v1/public/newsletter",
      "/v1/public/offers",
      "/v1/public/proposals",
      "/v1/public/storefront-verification",
    ])
  })
})
