// agent-quality: file-size exception — app.ts is the framework composition root;
// splitting it is intentional follow-up work, not part of voyant#2114.
import { OpenAPIHono } from "@hono/zod-openapi"
import {
  createContainer,
  createEventBus,
  createQueryRunner,
  type EventFilterDescriptor,
  type WorkflowDescriptor,
} from "@voyant-travel/core"
import type { WorkflowDriver } from "@voyant-travel/workflows/driver"
import type { Hono } from "hono"

import { assembleAnonymousPaths } from "./anonymous-paths.js"
import {
  containerToServiceResolver,
  makeFrameworkLogger,
  wireWorkflowRuntime,
} from "./app-workflows.js"
import { type LazyRoutesLoader, mountLazyRoutePaths, mountLazyRoutesAt } from "./lazy-routes.js"
import { mountAuthForwarding } from "./lib/auth-forward.js"
import { createPathDbSelector } from "./lib/db-selector.js"
import { tryGetExecutionCtx } from "./lib/execution-ctx.js"
import { matchesPublicPath, normalizePathname } from "./lib/public-paths.js"
import { requestScopedEventBus } from "./lib/request-event-bus.js"
import { createRequestOutboxStore } from "./lib/request-outbox-store.js"
import { requireAuth } from "./middleware/auth.js"
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  MAX_GLOBAL_REQUEST_BODY_BYTES,
  requestBodyLimit,
} from "./middleware/body-size.js"
import { cors } from "./middleware/cors.js"
import { db } from "./middleware/db.js"
import { handleApiError, requestId } from "./middleware/error-boundary.js"
import { logger } from "./middleware/logger.js"
import { metrics } from "./middleware/metrics.js"
import { publicResponseCache } from "./middleware/public-cache.js"
import {
  type RateLimitConfig,
  type RateLimitPolicy,
  rateLimit,
  resolveRateLimitStore,
} from "./middleware/rate-limit.js"
import { requireActor } from "./middleware/require-actor.js"
import { securityHeaders } from "./middleware/security-headers.js"
import { resolveSurfaceMountPath } from "./mount-paths.js"
import { noopReporter, safeCaptureException } from "./observability/reporter.js"
import { getRequestId } from "./observability/request-context.js"
import { expandHonoPlugins } from "./plugin.js"
import type { VoyantAppConfig, VoyantBindings, VoyantDb, VoyantVariables } from "./types.js"

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** The composed app's Hono env (bindings + framework request variables). */
type MountEnv<TBindings extends VoyantBindings> = {
  Bindings: TBindings
  Variables: VoyantVariables
}

function resolveConfiguredRateLimitStore<TBindings extends VoyantBindings>(
  config: RateLimitConfig | undefined,
  env: TBindings,
) {
  if (!config?.store) return undefined
  return typeof config.store === "function" ? config.store(env) : config.store
}

function buildRateLimitPolicy<TBindings extends VoyantBindings>(
  config: RateLimitConfig | undefined,
  env: TBindings,
  bucket: string,
  defaults: { max: number; windowSeconds: number },
): RateLimitPolicy {
  return {
    bucket,
    ...defaults,
    store: resolveConfiguredRateLimitStore(config, env) ?? resolveRateLimitStore({ env }),
  }
}

/**
 * A lazy route family recorded at mount time so a build-time OpenAPI generator
 * can eager-load it and merge its `.openapi()` operations (voyant#2114). Mirrors
 * `LazyMount` in `./openapi.ts` (kept structurally identical, but declared here
 * to avoid pulling the build-time-only openapi module into the runtime path).
 */
export interface LazyMount {
  /** Absolute surface mount prefix, or `"/"` for absolute `lazyRoutes`. */
  prefix: string
  load: LazyRoutesLoader
}

/**
 * A single module route mount recorded at mount time so a build-time generator
 * can produce one self-contained OpenAPI document per module (voyant#2733).
 * Mirrors `ModuleMount` in `./openapi.ts` (structurally identical, declared here
 * to keep the build-time-only openapi module out of the runtime path). `load`
 * returns the sub-app without serving it — eager mounts wrap the already-built
 * routes as `() => routes`; lazy mounts pass their loader.
 */
export interface ModuleMount {
  moduleName: string
  /** Absolute surface mount prefix, or `"/"` for absolute `lazyRoutes`. */
  prefix: string
  // biome-ignore lint/suspicious/noExplicitAny: accepts any composed sub-app regardless of its Env/Schema/BasePath, matching LazyRoutesLoader's AnyHono.
  load: () => Hono<any, any, any> | Promise<Hono<any, any, any>>
}

/**
 * App handle returned alongside the Hono instance. Carries `ready()` for
 * headless / sibling-process deployments that need to fire the lazy
 * bootstrap before the first HTTP request — workflow runtimes (node
 * sibling-process pattern, tests) call this so the time wheel and
 * manifest registration kick off without traffic.
 *
 * Returned via the augmented Hono instance: `app.ready` is attached
 * directly so the existing call sites (which destructure / pass `app`
 * around) keep working without a wrapper.
 */
export interface VoyantAppExtensions<TBindings = unknown> {
  /**
   * Resolves once the lazy bootstrap completes. Idempotent — multiple
   * calls share the same promise. Use from tests + node sibling
   * processes where no request will arrive to trigger boot. See
   * architecture doc §18 + §18.1.
   *
   * Accepts the runtime bindings that the bootstrap should run with. For
   * binding-dependent configs (for example a managed-cloud forwarding
   * driver that reads credentials from `env`) callers MUST pass the real
   * bindings. Node and InMemory drivers usually ignore bindings, so the
   * no-arg form is safe there (defaults to `{}` for back-compat with tests).
   */
  ready(bindings?: TBindings): Promise<void>
  /**
   * The app's event bus (with every module/plugin subscriber attached).
   * Exposed for non-request contexts that must deliver events through
   * the same subscriber set — the outbox drain in a scheduled handler
   * being the canonical consumer:
   *
   *     await app.ready(env)
   *     await withDbFromEnv(env, (db) => drainOutbox(db, app.eventBus))
   */
  eventBus: import("@voyant-travel/core").EventBus
  /**
   * Lazy route families recorded at mount time (the wildcard dispatch stubs in
   * `lazy-routes.ts` don't reach the composed `OpenAPIHono` registry). A
   * build-time OpenAPI generator reads this to eager-load + merge their
   * `.openapi()` operations via `mergeLazyOpenApiPaths`. Never read at runtime.
   */
  lazyMounts: LazyMount[]
  /**
   * Every module route mount (admin + public, eager + lazy), tagged with its
   * owning module name (voyant#2733). A build-time generator reads this to
   * produce one self-contained OpenAPI document per module via
   * `generateModuleOpenApiDocuments`, keeping the module boundary authoritative
   * rather than guessed from path prefixes. Never read at runtime.
   */
  moduleMounts: ModuleMount[]
}

/**
 * Low-level app factory: given an already-resolved `modules`/`extensions` set
 * (plus middleware config), build the Hono app. Most deployments use the
 * config-driven `createApp` (see `create-app.ts`), which derives the modules
 * from a manifest + registry + capabilities and delegates here. Use `mountApp`
 * directly only when you have the resolved set in hand (tests, advanced hosts).
 */
export function mountApp<TBindings extends VoyantBindings>(
  config: VoyantAppConfig<TBindings>,
): Hono<MountEnv<TBindings>> & VoyantAppExtensions<TBindings> {
  // Composed root is an OpenAPIHono (a drop-in Hono superclass) so module routes
  // authored with `.openapi()` register here and the spec can be generated via
  // `@voyant-travel/hono/openapi` at build time. The doc *generator*
  // (`@asteasolutions/zod-to-openapi` + `openapi3-ts`) is only reachable through
  // `getOpenAPIDocument`, so it tree-shakes out of the Worker bundle; the
  // OpenAPIHono registry + validator glue (~35 KB) is the only runtime cost.
  const app: Hono<MountEnv<TBindings>> = new OpenAPIHono<MountEnv<TBindings>>()
  // Observability sink (RFC #1553) — resolved once and reused by both the
  // outer onError and the forwarded auth sub-app catch point below.
  const reporter = config.reporter ?? noopReporter
  const appName = config.appName ?? "voyant"
  app.onError((err, c) => handleApiError(err, c, { reporter, appName }))

  // Expand plugins into their constituent modules/extensions before mounting
  const expanded = config.plugins ? expandHonoPlugins(config.plugins) : null
  const allModules = [...(config.modules ?? []), ...(expanded?.modules ?? [])]
  const allExtensions = [...(config.extensions ?? []), ...(expanded?.extensions ?? [])]
  // Anonymous-access allow-list (ADR-0008): assembled from module/extension
  // `anonymous` declarations + bundle-declared absolute anonymous paths (e.g. a
  // payment-processor webhook) + any explicit `publicPaths` escape-hatch entries.
  // Used by both the auth middleware (skip auth / stamp customer actor) and the
  // public-write rate-limit matcher below, so the two never diverge.
  const anonymousPaths = assembleAnonymousPaths(allModules, allExtensions, [
    ...(config.publicPaths ?? []),
    ...(expanded?.anonymousPaths ?? []),
  ])
  // When the framework owns the bus, route subscriber-dispatch failures
  // (including the workflow forwarder) to the reporter — they're otherwise
  // only console-logged per the fire-and-forget EventBus contract (RFC #1553).
  // A deployment-supplied bus owns its own error routing.
  const eventBus =
    config.eventBus ??
    createEventBus({
      onSubscriberError: (event, error) =>
        safeCaptureException(reporter, {
          requestId: getRequestId() ?? "",
          app: appName,
          error,
          context: { event, surface: "event-bus" },
        }),
    })
  const query =
    typeof config.query === "function"
      ? config.query
      : config.query
        ? createQueryRunner(config.query)
        : undefined

  // Module container — registered services are resolvable from routes
  const container = createContainer()
  for (const mod of allModules) {
    if (mod.module.service !== undefined) {
      container.register(mod.module.name, mod.module.service)
    }
  }
  for (const sub of expanded?.subscribers ?? []) {
    eventBus.subscribe(sub.event, sub.handler, { inline: sub.inline ?? false })
  }

  // ---- Workflow runtime wiring (synchronous setup; manifest registration
  //      + EventBus forwarder run inside the lazy bootstrap below) ----
  //
  // We collect `workflows` + `eventFilters` from every module and plugin
  // here so the failure mode for "duplicate workflow id across modules"
  // surfaces at construction time (per architecture doc §18, the workflow
  // runtime is fail-closed).
  const collectedWorkflows: WorkflowDescriptor[] = []
  const collectedFilters: EventFilterDescriptor[] = []
  for (const mod of allModules) {
    if (mod.module.workflows) collectedWorkflows.push(...mod.module.workflows)
    if (mod.module.eventFilters) collectedFilters.push(...mod.module.eventFilters)
  }
  for (const plugin of config.plugins ?? []) {
    if (plugin.workflows) collectedWorkflows.push(...plugin.workflows)
    if (plugin.eventFilters) collectedFilters.push(...plugin.eventFilters)
  }
  // Validate duplicate workflow ids across modules + plugins. Same id from
  // re-imports (HMR / shared bundles) is fine because identity is by id —
  // we only flag genuinely-different definitions sharing an id.
  if (config.workflows && collectedWorkflows.length > 0) {
    const seen = new Map<string, WorkflowDescriptor>()
    for (const wf of collectedWorkflows) {
      const existing = seen.get(wf.id)
      if (existing && existing !== wf) {
        throw new Error(
          `[voyant] duplicate workflow id "${wf.id}" registered by multiple modules/plugins. ` +
            `Workflow ids must be unique across the app — use a module-scoped prefix ` +
            `(e.g. "${wf.id.includes(".") ? wf.id : `<module>.${wf.id}`}").`,
        )
      }
      seen.set(wf.id, wf)
    }
  }

  // Workflow driver construction is **deferred** to the lazy bootstrap
  // path so callers whose driver options come from `env.*` bindings can
  // pass a function-of-bindings shape. Node / InMemory users usually
  // return a direct factory from that function.
  let workflowDriver: WorkflowDriver | undefined

  let bootstrapPromise: Promise<void> | null = null
  function ensureRuntimeBootstrapped(bindings: TBindings) {
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        const ctx = { bindings, container, eventBus }

        // ---- Workflow runtime FIRST — fail-closed manifest registration
        //      and EventBus forwarder must be in place before any module
        //      bootstrap can emit. Otherwise a `module.bootstrap` that
        //      emits an event during its own bootstrap would route through
        //      a bus with no workflow forwarder yet, silently losing the
        //      event. Per architecture doc §21.22 + reviewer feedback P2.3.
        if (config.workflows) {
          // `driver` is always a function-of-bindings (per
          // VoyantWorkflowsConfig — see types.ts + reviewer feedback P2.1).
          // Node / InMemory users wrap with `() => createXxxDriver({...})`.
          // Managed-cloud users can derive a forwarding driver from `env`.
          // We invoke with bindings, then the resulting DriverFactory
          // with framework deps.
          const factoryDeps = {
            services: containerToServiceResolver(container),
            logger: makeFrameworkLogger(config.logger),
          }
          const factory = config.workflows.driver(bindings)
          workflowDriver = factory(factoryDeps)

          await wireWorkflowRuntime({
            modules: allModules.map((m) => m.module),
            collectedWorkflows,
            collectedFilters,
            driver: workflowDriver,
            environment: config.workflows.environment ?? "development",
            projectId: config.workflows.projectId ?? "default",
            eventBus,
          })
        }

        // Run each bootstrap in isolation — a single failing plugin/module/extension
        // must not poison the cached promise and kill the whole app's request pipeline.
        const runIsolated = async (label: string, fn?: (c: typeof ctx) => unknown) => {
          if (!fn) return
          try {
            await fn(ctx)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[voyant] bootstrap failed for ${label}: ${message}`)
            // Bootstrap failures are startup-critical but silent today — surface
            // them to the reporter too (RFC #1553). No request context here.
            safeCaptureException(reporter, {
              requestId: getRequestId() ?? "",
              app: appName,
              error,
              context: { label, surface: "bootstrap" },
            })
          }
        }

        for (const plugin of config.plugins ?? []) {
          await runIsolated(`plugin:${plugin.name}`, plugin.bootstrap)
        }
        for (const mod of allModules) {
          await runIsolated(`module:${mod.module.name}`, mod.module.bootstrap)
        }
        for (const ext of allExtensions) {
          await runIsolated(
            `extension:${ext.extension.module}/${ext.extension.name}`,
            ext.extension.bootstrap,
          )
        }
      })()
    }

    return bootstrapPromise
  }

  // Request ID header
  app.use("*", requestId)

  // Structured logger
  app.use("*", logger(config.logger))

  // Per-request metrics → Analytics Engine (no-op without the binding).
  // Mounted before the cache middleware so cache hits are measured too.
  if (config.metrics !== false) {
    app.use("*", metrics())
  }

  // CORS (allowlist via env CORS_ALLOWLIST)
  app.use("*", cors())

  if (config.securityHeaders !== false) {
    app.use("*", securityHeaders(config.securityHeaders))
  }

  if (config.requestBodyLimit !== false) {
    app.use(
      "*",
      requestBodyLimit({
        // Outer ceiling sized to the largest legitimate body (uploads); the
        // upload route enforces its own 25 MiB cap. See MAX_GLOBAL_REQUEST_BODY_BYTES.
        maxBytes: config.requestBodyLimit?.maxBytes ?? MAX_GLOBAL_REQUEST_BODY_BYTES,
        // JSON bodies keep the tighter 10 MiB cap (matching parseJsonBody) so
        // migrated `.openapi()` routes aren't loosened to the upload ceiling.
        jsonMaxBytes: config.requestBodyLimit?.jsonMaxBytes ?? DEFAULT_REQUEST_BODY_LIMIT_BYTES,
      }),
    )
  }

  if (config.rateLimit !== false) {
    const rateLimitConfig = config.rateLimit

    if (rateLimitConfig?.auth !== false) {
      const authRule = rateLimitConfig?.auth ?? { max: 10, windowSeconds: 60 }
      app.use("/auth/*", async (c, next) => {
        if (c.req.method !== "POST") return next()
        return rateLimit(buildRateLimitPolicy(rateLimitConfig, c.env, "auth", authRule))(c, next)
      })
    }

    if (rateLimitConfig?.publicWrite !== false) {
      const publicWriteRule = rateLimitConfig?.publicWrite ?? { max: 60, windowSeconds: 60 }
      app.use("*", async (c, next) => {
        if (!WRITE_METHODS.has(c.req.method)) return next()
        const pathname = normalizePathname(new URL(c.req.url).pathname, {
          basePath: config.basePath,
        })
        const isPublicWrite =
          pathname.startsWith("/v1/public/") || matchesPublicPath(pathname, anonymousPaths)
        if (!isPublicWrite) return next()
        return rateLimit(
          buildRateLimitPolicy(rateLimitConfig, c.env, "public-write", publicWriteRule),
        )(c, next)
      })
    }
  }

  // Shared response cache for the public surface. Mounted BEFORE the
  // runtime bootstrap on purpose: a cache hit skips module-graph
  // instantiation, auth, and the per-request db client entirely — the
  // hit path allocates nothing but the cached body. Only responses a
  // route explicitly marks `Cache-Control: public, s-maxage=…` are
  // stored (see middleware docs).
  if (config.publicCache !== false) {
    app.use("*", publicResponseCache(config.publicCache ?? {}))
  }

  // Per-request outbox store factory: emits happen in route handlers,
  // after the db middleware ran, so the request's db client is resolved
  // lazily at capture time. Outbox writes are single statements — the
  // cheap http client on non-transactional surfaces handles them fine.
  const buildOutboxStore = config.outbox
    ? (c: { env: TBindings; get(key: never): unknown }) =>
        createRequestOutboxStore({
          env: c.env,
          operationDbFactory: config.db,
          requestDb: () => c.get("db" as never) as VoyantDb | undefined,
        })
    : undefined

  app.use("*", async (c, next) => {
    c.set("container", container)
    // Request-scoped bus: emits defer non-`inline` subscribers past the
    // response via waitUntil, so handlers doing outbound HTTP (CMS sync,
    // e-invoicing) no longer add their latency to every mutation.
    //
    // With `outbox: true`, emits are also durable (persisted before
    // delivery, retried by `drainOutbox` from @voyant-travel/db/outbox) —
    // INCLUDING on runtimes without an ExecutionContext (Node/headless),
    // where emits await handlers inline but still capture through the
    // store. Only when there's neither a scheduler nor a store does the
    // raw bus go on the context unwrapped.
    const executionCtx = tryGetExecutionCtx(c)
    const outboxStore = buildOutboxStore?.(c)
    c.set(
      "eventBus",
      executionCtx || outboxStore
        ? requestScopedEventBus(
            eventBus,
            executionCtx ? (pending) => executionCtx.waitUntil(pending) : undefined,
            outboxStore,
          )
        : eventBus,
    )
    if (config.link) {
      c.set("link", config.link)
    }
    if (query) {
      c.set("query", query)
    }
    // Bootstrap (fires once, idempotent) — resolves the workflow driver
    // with c.env-supplied bindings on the first request, so deferred
    // driver construction sees real runtime bindings (reviewer P2.1).
    await ensureRuntimeBootstrapped(c.env)
    if (workflowDriver) {
      // Surfaced on `c.var.workflowDriver` so HTTP route handlers can
      // call `driver.trigger(...)` directly without re-resolving from
      // the container. Also used by the optional HTTP ingest adapter
      // (`mountHttpIngestAdapter` from `@voyant-travel/workflows/http-ingest`).
      c.set("workflowDriver", workflowDriver)
    }
    return next()
  })

  // Health check (public, no auth)
  app.get("/health", (c) => c.json({ status: "ok" }))

  // App-owned auth handler (must be before auth middleware — these routes are
  // public). Forwarding + observability bridging live in `mountAuthForwarding`.
  const authHandler = config.auth?.handler
  if (authHandler) {
    mountAuthForwarding(app, authHandler, { reporter, appName })
  }

  // Transactional surface map: a request must be served by a
  // transaction-capable db client when its path belongs to (a) a module
  // declaring `requiresTransactionalDb`, (b) a module targeted by an
  // extension that declares it (extensions mount under the target
  // module's prefix — e.g. catalog-authoring's compose routes live under
  // /v1/admin/products), or (c) a template-supplied extra path
  // (`dbTransactionalPaths` — for additionalRoutes / adapter-wired flows
  // like the catalog booking engine whose transactionality depends on
  // starter wiring).
  const txModuleNames = new Set<string>(
    allModules.filter((m) => m.module.requiresTransactionalDb).map((m) => m.module.name),
  )
  for (const ext of allExtensions) {
    if (ext.extension.requiresTransactionalDb) txModuleNames.add(ext.extension.module)
  }
  const txRequiringModules = [...txModuleNames]
  const txPrefixes: string[] = [...(config.dbTransactionalPaths ?? [])]
  for (const name of txModuleNames) {
    // `/v1/public/<name>` is added unconditionally (not only when the
    // module mounts publicRoutes): other modules mounted at the public
    // root can serve paths under a flagged module's segment — e.g.
    // storefront (publicPath "/") handles
    // /v1/public/bookings/sessions/bootstrap, which reaches
    // bookings' transactional reserve flow.
    txPrefixes.push(`/v1/admin/${name}`, `/v1/${name}`, `/v1/public/${name}`)
  }
  for (const mod of allModules) {
    if (txModuleNames.has(mod.module.name) && mod.publicRoutes) {
      txPrefixes.push(resolveSurfaceMountPath("/v1/public", mod.publicPath, mod.module.name))
    }
    // Absolute transactional prefixes for routes mounted outside the name-based
    // surface (e.g. a lazy family at `/v1/admin/catalog/quote`), so the
    // deployment doesn't hand-maintain them in `dbTransactionalPaths` (ADR-0008).
    if (mod.transactionalPaths) txPrefixes.push(...mod.transactionalPaths)
  }
  for (const ext of allExtensions) {
    if (txModuleNames.has(ext.extension.module) && ext.publicRoutes) {
      txPrefixes.push(resolveSurfaceMountPath("/v1/public", ext.publicPath, ext.extension.module))
    }
    if (ext.transactionalPaths) txPrefixes.push(...ext.transactionalPaths)
  }

  // With a `dbTransactional` factory, requests are routed per surface:
  // transactional prefixes get it, everything else gets the cheap
  // default (typically neon-http — no per-request connection handshake).
  // Without it, `config.db` serves everything as before.
  const dbSource = config.dbTransactional
    ? createPathDbSelector({
        defaultFactory: config.db,
        transactionalFactory: config.dbTransactional,
        transactionalPrefixes: txPrefixes,
      })
    : config.db

  const authOptions = { publicPaths: anonymousPaths, basePath: config.basePath, auth: config.auth }

  // Auth middleware for all other routes
  app.use("*", requireAuth(dbSource, authOptions))

  // DB middleware — sets c.var.db for all downstream handlers.
  // Pass the list of modules that need interactive transactions so the
  // middleware can throw a clear startup-style error on first request if
  // the wired adapter is neon-http (which doesn't support db.transaction).
  app.use(
    "*",
    db(dbSource, { requiresTransactionalDb: txRequiringModules, basePath: config.basePath }),
  )

  // Actor guards for the two API surfaces
  const actorOptions = { basePath: config.basePath }
  app.use("/v1/admin/*", requireActor(actorOptions, "staff"))
  app.use("/v1/public/*", requireActor(actorOptions, "customer", "partner", "supplier"))

  // Admin capability discovery — GET /v1/admin/_meta/capabilities. A built-in
  // framework route (like /health), mounted only when the deployment supplies
  // the operation catalogue via `config.adminMeta` (from
  // `@voyant-travel/admin-contracts`) — keeping `@voyant-travel/hono` decoupled from it.
  // Guarded by the `/v1/admin/*` staff actor guard above.
  if (config.adminMeta) {
    const adminMeta = config.adminMeta
    app.get("/v1/admin/_meta/capabilities", (c) =>
      c.json({
        contractVersion: adminMeta.contractVersion,
        ...(adminMeta.deploymentVersion ? { deploymentVersion: adminMeta.deploymentVersion } : {}),
        modules: allModules.map((m) => m.module.name),
        operations: adminMeta.operations,
        actor: c.get("actor"),
        scopes: c.get("scopes"),
      }),
    )
  }

  // Lazy route families recorded for build-time OpenAPI merging. The wildcard
  // dispatch stubs registered by `mountLazyRoutesAt`/`mountLazyRoutePaths` never
  // reach the composed OpenAPIHono registry, so the spec generator replays these
  // loaders (see `mergeLazyOpenApiPaths`). Recorded in the same loop that mounts
  // them so the prefix logic is single-sourced here. Cheap array pushes — no
  // eager `import()` and no runtime read.
  const lazyMounts: LazyMount[] = []
  // Per-module OpenAPI generation manifest (voyant#2733). Recorded alongside the
  // mount so the module name + real prefix are single-sourced here; `publicPath`
  // overrides are captured with their actual mount, not re-derived. Eager routes
  // are wrapped as `() => routes` so the generator's loader-based path is
  // uniform across eager + lazy. Webhook routes are intentionally excluded — the
  // per-module docs cover the admin/storefront surfaces only.
  const moduleMounts: ModuleMount[] = []

  // Mount module routes
  for (const mod of allModules) {
    const moduleName = mod.module.name
    const adminPrefix = `/v1/admin/${moduleName}`
    const publicPrefix = resolveSurfaceMountPath("/v1/public", mod.publicPath, moduleName)
    if (mod.adminRoutes) {
      const adminRoutes = mod.adminRoutes
      app.route(adminPrefix, adminRoutes)
      moduleMounts.push({ moduleName, prefix: adminPrefix, load: () => adminRoutes })
    }
    if (mod.publicRoutes) {
      const publicRoutes = mod.publicRoutes
      app.route(publicPrefix, publicRoutes)
      moduleMounts.push({ moduleName, prefix: publicPrefix, load: () => publicRoutes })
    }
    if (mod.lazyAdminRoutes) {
      mountLazyRoutesAt(app, adminPrefix, mod.lazyAdminRoutes)
      lazyMounts.push({ prefix: adminPrefix, load: mod.lazyAdminRoutes })
      moduleMounts.push({ moduleName, prefix: adminPrefix, load: mod.lazyAdminRoutes })
    }
    if (mod.lazyPublicRoutes) {
      mountLazyRoutesAt(app, publicPrefix, mod.lazyPublicRoutes)
      lazyMounts.push({ prefix: publicPrefix, load: mod.lazyPublicRoutes })
      moduleMounts.push({ moduleName, prefix: publicPrefix, load: mod.lazyPublicRoutes })
    }
    if (mod.lazyRoutes) {
      mountLazyRoutePaths(app, mod.lazyRoutes.paths, mod.lazyRoutes.load)
      lazyMounts.push({ prefix: "/", load: mod.lazyRoutes.load })
      moduleMounts.push({ moduleName, prefix: "/", load: mod.lazyRoutes.load })
    }
    if (mod.webhookRoutes) {
      app.route(`/v1/${moduleName}`, mod.webhookRoutes)
    }
  }

  // Mount extension routes
  for (const ext of allExtensions) {
    const moduleName = ext.extension.module
    const adminPrefix = `/v1/admin/${moduleName}`
    const publicPrefix = resolveSurfaceMountPath("/v1/public", ext.publicPath, moduleName)
    if (ext.adminRoutes) {
      const adminRoutes = ext.adminRoutes
      app.route(adminPrefix, adminRoutes)
      moduleMounts.push({ moduleName, prefix: adminPrefix, load: () => adminRoutes })
    }
    if (ext.publicRoutes) {
      const publicRoutes = ext.publicRoutes
      app.route(publicPrefix, publicRoutes)
      moduleMounts.push({ moduleName, prefix: publicPrefix, load: () => publicRoutes })
    }
    if (ext.lazyAdminRoutes) {
      mountLazyRoutesAt(app, adminPrefix, ext.lazyAdminRoutes)
      lazyMounts.push({ prefix: adminPrefix, load: ext.lazyAdminRoutes })
      moduleMounts.push({ moduleName, prefix: adminPrefix, load: ext.lazyAdminRoutes })
    }
    if (ext.lazyPublicRoutes) {
      mountLazyRoutesAt(app, publicPrefix, ext.lazyPublicRoutes)
      lazyMounts.push({ prefix: publicPrefix, load: ext.lazyPublicRoutes })
      moduleMounts.push({ moduleName, prefix: publicPrefix, load: ext.lazyPublicRoutes })
    }
    if (ext.lazyRoutes) {
      mountLazyRoutePaths(app, ext.lazyRoutes.paths, ext.lazyRoutes.load)
      lazyMounts.push({ prefix: "/", load: ext.lazyRoutes.load })
      moduleMounts.push({ moduleName, prefix: "/", load: ext.lazyRoutes.load })
    }
    if (ext.webhookRoutes) {
      app.route(`/v1/${moduleName}`, ext.webhookRoutes)
    }
  }

  // Additional routes
  if (config.additionalRoutes) {
    config.additionalRoutes(app)
  }

  // Attach `ready()` directly to the Hono instance. Fires the lazy
  // bootstrap with the supplied bindings (or `{}` for back-compat with
  // node / InMemory drivers that ignore them). Production code never
  // calls `ready()` — the first request triggers the same boot via
  // `ensureRuntimeBootstrapped(c.env)`. Tests + node sibling processes
  // use this so the time wheel + manifest registration happen without
  // traffic. Binding-dependent drivers that want eager boot must pass
  // the real `env`.
  const augmented = app as Hono<MountEnv<TBindings>> & VoyantAppExtensions<TBindings>
  augmented.eventBus = eventBus
  augmented.lazyMounts = lazyMounts
  augmented.moduleMounts = moduleMounts
  augmented.ready = (bindings?: TBindings) =>
    ensureRuntimeBootstrapped(bindings ?? ({} as TBindings))
  return augmented
}
