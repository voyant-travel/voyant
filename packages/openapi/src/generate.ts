import {
  composeVoyantGraphRuntime,
  createVoyantApp,
  createVoyantGraphRuntimePortStubs,
  frameworkComposition,
  resolveStandardNodeGraphRuntime,
} from "@voyant-travel/framework"
import {
  buildModulePathOwnership,
  type GenerateOpenApiOptions,
  generateOpenApiDocument,
  mergeLazyOpenApiPaths,
  type OpenApiDocument,
  partitionByModule,
  selectSurface,
  stampModuleMetadata,
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
  /**
   * One self-contained document per module, keyed by module name. Generated
   * directly from each module's registered routes (voyant#2733) — the
   * authoritative boundary — so a consumer can browse/diff a single domain
   * instead of the multi-megabyte aggregate. A module doc may span both
   * surfaces; split with `selectSurface` when writing `admin/`/`storefront/`.
   */
  modules: Map<string, OpenApiDocument>
}

const OPENAPI_OPTIONS: GenerateOpenApiOptions = {
  info: {
    title: "Voyant Framework API",
    version: "0.0.0",
    description:
      "Generated from the Voyant framework's standard module composition. Do not edit by hand.",
  },
  // Relative server so Swagger/Scalar "try it out" targets whatever origin the
  // deployment serves this contract from (voyant#2729). A deployment can
  // override with a concrete host.
  servers: [{ url: "/", description: "This deployment (same origin)" }],
}

export async function buildFrameworkOpenApiDocuments(): Promise<FrameworkOpenApiDocuments> {
  const runtime = await resolveStandardNodeGraphRuntime()
  const composition = await composeVoyantGraphRuntime({
    runtime,
    capabilities: deepStub,
    ports: createVoyantGraphRuntimePortStubs(runtime),
  })
  const modules = Object.fromEntries([
    ...runtime.modules.flatMap((unit) => {
      const factory = frameworkComposition.modules[unit.id.replace("#", "/")]
      return factory ? [[`legacy:${unit.id}`, factory] as const] : []
    }),
    ...composition.modules.map(
      (module, index) => [`graph:${index}:${module.module.name}`, () => module] as const,
    ),
  ])
  const extensions = Object.fromEntries([
    ...[...runtime.extensions, ...runtime.plugins].flatMap((unit) => {
      const factory = frameworkComposition.extensions?.[unit.id.replace("#", "/")]
      return factory ? [[`legacy:${unit.id}`, factory] as const] : []
    }),
    ...composition.extensions.map(
      (extension, index) =>
        [`graph:${index}:${extension.extension.name}`, () => extension] as const,
    ),
  ])
  const app = createVoyantApp({
    providers: deepStub,
    db: deepStub,
    standard: false,
    modules,
    extensions,
  })
  const eager = generateOpenApiDocument(app, OPENAPI_OPTIONS)
  // Lazy families mount as runtime wildcard stubs, so their `.openapi()` routes
  // never reach the composed registry — replay their loaders and merge, matching
  // the operator generator and the per-module docs (which load lazily too).
  const merged = await mergeLazyOpenApiPaths(eager, app.lazyMounts ?? [], OPENAPI_OPTIONS)
  // Build the authoritative path→module map once, then stamp the aggregate so
  // every derived doc (surfaces + per-module) inherits `x-voyant-module` /
  // `x-voyant-surface`. Partitioning covers the FULL surface, so nothing is
  // dropped — `additionalRoutes` / directly-mounted routes aren't in the
  // manifest and fall back to their path segment.
  const owner = await buildModulePathOwnership(app.moduleMounts ?? [], OPENAPI_OPTIONS)
  const full = stampModuleMetadata(merged, owner)
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
    modules: partitionByModule(full, owner),
  }
}
