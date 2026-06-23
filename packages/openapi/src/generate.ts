import { createVoyantApp } from "@voyant-travel/framework"
import {
  generateOpenApiDocument,
  type OpenApiDocument,
  selectSurface,
} from "@voyant-travel/hono/openapi"

/**
 * Builds the Voyant **framework** OpenAPI documents (voyant#2114).
 *
 * The spec is the union of every standard framework module's `.openapi()`
 * routes, composed at their real mounted paths — NOT a hand-curated subset and
 * NOT a single deployment's surface. It is generated from a framework-only
 * composition (`createVoyantApp` with no deployment-local modules), so
 * deployment-specific routes (a payment provider's webhooks, niche modules like
 * MICE/cruises a starter installs) never leak into the published contract.
 *
 * Providers are never invoked here — doc generation only reads the mounted
 * route metadata, no request is served — so a deep stub satisfies the injected
 * `FrameworkProviders`/`db` surface.
 */
// biome-ignore lint/suspicious/noExplicitAny: coercion-safe provider/db stub; never called during doc generation.
const deepStub: any = new Proxy(() => deepStub, {
  get: (_target, prop) => {
    if (prop === Symbol.toPrimitive) return () => "stub"
    if (prop === "then") return undefined
    return deepStub
  },
  apply: () => deepStub,
})

export interface FrameworkOpenApiDocuments {
  /** Every documented framework route (admin + storefront + legacy). */
  full: OpenApiDocument
  /** Admin surface only (`/v1/admin/*`). */
  admin: OpenApiDocument
  /** Storefront/public surface only (`/v1/public/*`). */
  storefront: OpenApiDocument
}

export function buildFrameworkOpenApiDocuments(): FrameworkOpenApiDocuments {
  const app = createVoyantApp({ providers: deepStub, db: deepStub })
  const full = generateOpenApiDocument(app, {
    info: {
      title: "Voyant Framework API",
      version: "0.0.0",
      description:
        "Generated from the Voyant framework's standard module composition. Do not edit by hand.",
    },
  })
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
  }
}
