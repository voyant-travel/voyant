import {
  createContainer,
  createEventBus,
  createQueryRunner,
  type EventEnvelope,
  type EventFilterDescriptor,
  type Module,
  type ModuleContainer,
  type WorkflowDescriptor,
} from "@voyantjs/core"
import { buildManifest, type EventFilterRuntimeEntry } from "@voyantjs/workflows/events"
import { Hono } from "hono"

import { requireAuth } from "./middleware/auth.js"
import { cors } from "./middleware/cors.js"
import { db } from "./middleware/db.js"
import { handleApiError, requestId } from "./middleware/error-boundary.js"
import { logger } from "./middleware/logger.js"
import { requireActor } from "./middleware/require-actor.js"
import { expandHonoPlugins } from "./plugin.js"
import type { VoyantAppConfig, VoyantBindings, VoyantVariables } from "./types.js"

function resolveSurfaceMountPath(
  prefix: string,
  path: string | undefined,
  fallback: string,
): string {
  const normalized = path?.trim()

  if (!normalized) {
    return `${prefix}/${fallback}`
  }

  if (normalized === "/") {
    return prefix
  }

  return `${prefix}/${normalized.replace(/^\/+|\/+$/g, "")}`
}

/**
 * App handle returned alongside the Hono instance. Carries `ready()` for
 * headless / sibling-process deployments that need to fire the lazy
 * bootstrap before the first HTTP request — workflow runtimes (Mode 2's
 * sibling-process pattern, tests) call this so the time wheel and
 * manifest registration kick off without traffic.
 *
 * Returned via the augmented Hono instance: `app.ready` is attached
 * directly so the existing call sites (which destructure / pass `app`
 * around) keep working without a wrapper.
 */
export interface VoyantAppExtensions {
  /**
   * Resolves once the lazy bootstrap completes. Idempotent — multiple
   * calls share the same promise. Use from tests + Mode 2 sibling
   * processes where no request will arrive to trigger boot. See
   * architecture doc §18 + §18.1.
   */
  ready(): Promise<void>
}

export function createApp<TBindings extends VoyantBindings>(
  config: VoyantAppConfig<TBindings>,
): Hono<{ Bindings: TBindings; Variables: VoyantVariables }> & VoyantAppExtensions {
  const app = new Hono<{ Bindings: TBindings; Variables: VoyantVariables }>()
  app.onError(handleApiError)

  // Expand plugins into their constituent modules/extensions before mounting
  const expanded = config.plugins ? expandHonoPlugins(config.plugins) : null
  const allModules = [...(config.modules ?? []), ...(expanded?.modules ?? [])]
  const allExtensions = [...(config.extensions ?? []), ...(expanded?.extensions ?? [])]
  const eventBus = config.eventBus ?? createEventBus()
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
    eventBus.subscribe(sub.event, sub.handler)
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
  // path so CF-edge users (whose driver options come from `env.*`
  // bindings only available at request time) can pass a function-of-
  // bindings shape — `(env) => createCloudflareEdgeDriver({...})` —
  // rather than constructing at module-load time. Mode 2 / InMemory
  // users pass a direct factory; the framework adapts both shapes.
  // See reviewer feedback P2.1 + architecture doc §6.3.
  // biome-ignore lint/suspicious/noExplicitAny: WorkflowDriver shape varies across driver implementations
  let workflowDriver: any | undefined

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
          // Mode 2 / InMemory users wrap with `() => createXxxDriver({...})`.
          // CF-edge users use `(env) => createCloudflareEdgeDriver({ env.* })`.
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

  app.use("*", async (c, next) => {
    c.set("container", container)
    c.set("eventBus", eventBus)
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
      // (`mountHttpIngestAdapter` from `@voyantjs/workflows/http-ingest`).
      ;(c as unknown as { set: (k: string, v: unknown) => void }).set(
        "workflowDriver",
        workflowDriver,
      )
    }
    return next()
  })

  // Request ID header
  app.use("*", requestId)

  // Structured logger
  app.use("*", logger(config.logger))

  // CORS (allowlist via env CORS_ALLOWLIST)
  app.use("*", cors())

  // Health check (public, no auth)
  app.get("/health", (c) => c.json({ status: "ok" }))

  // App-owned auth handler (must be before auth middleware — these routes are public)
  const authHandler = config.auth?.handler
  if (authHandler) {
    app.all("/auth/*", async (c) => {
      const authApp = authHandler(c.env)
      return authApp.fetch(c.req.raw, c.env, c.executionCtx)
    })
  }

  // Auth middleware for all other routes
  app.use("*", requireAuth(config.db, { publicPaths: config.publicPaths, auth: config.auth }))

  // DB middleware — sets c.var.db for all downstream handlers
  app.use("*", db(config.db))

  // Actor guards for the two API surfaces
  app.use("/v1/admin/*", requireActor("staff"))
  app.use("/v1/public/*", requireActor("customer", "partner", "supplier"))

  // Mount module routes
  for (const mod of allModules) {
    if (mod.adminRoutes) {
      app.route(`/v1/admin/${mod.module.name}`, mod.adminRoutes)
    }
    if (mod.publicRoutes) {
      app.route(
        resolveSurfaceMountPath("/v1/public", mod.publicPath, mod.module.name),
        mod.publicRoutes,
      )
    }
    if (mod.routes) {
      app.route(`/v1/${mod.module.name}`, mod.routes)
    }
  }

  // Mount extension routes
  for (const ext of allExtensions) {
    if (ext.adminRoutes) {
      app.route(`/v1/admin/${ext.extension.module}`, ext.adminRoutes)
    }
    if (ext.publicRoutes) {
      app.route(
        resolveSurfaceMountPath("/v1/public", ext.publicPath, ext.extension.module),
        ext.publicRoutes,
      )
    }
    if (ext.routes) {
      app.route(`/v1/${ext.extension.module}`, ext.routes)
    }
  }

  // Additional routes
  if (config.additionalRoutes) {
    config.additionalRoutes(app)
  }

  // Attach `ready()` directly to the Hono instance. Fires the lazy
  // bootstrap eagerly with an empty bindings object — production code
  // never calls `ready()` (the first request triggers the same boot via
  // `ensureRuntimeBootstrapped(c.env)`); tests + Mode 2 sibling
  // processes use this so the time wheel + manifest registration happen
  // without traffic.
  const augmented = app as Hono<{ Bindings: TBindings; Variables: VoyantVariables }> &
    VoyantAppExtensions
  augmented.ready = () => ensureRuntimeBootstrapped({} as TBindings)
  return augmented
}

// ---- Internals ----

interface WireWorkflowRuntimeArgs {
  modules: ReadonlyArray<Module>
  collectedWorkflows: ReadonlyArray<WorkflowDescriptor>
  collectedFilters: ReadonlyArray<EventFilterDescriptor>
  // biome-ignore lint/suspicious/noExplicitAny: WorkflowDriver shape varies across drivers
  driver: any
  environment: "production" | "preview" | "development"
  projectId: string
  // biome-ignore lint/suspicious/noExplicitAny: EventBus.subscribe handler signature varies
  eventBus: { subscribe(event: string, handler: (e: any) => Promise<void> | void): unknown }
}

/**
 * Build the manifest, register it with the driver, and install a single
 * EventBus subscriber per unique eventType seen across the manifest's
 * filters — that subscriber forwards into `driver.ingestEvent(...)`.
 *
 * The forwarder stamps `metadata.eventId` with a fresh content-derived
 * id when missing, so the framework's idempotency derivation
 * (`${filterId}:${eventId}`) gives stable run-dedup across retries.
 *
 * Failure modes are fail-closed: a manifest registration that throws
 * rejects the bootstrap promise, and the next request sees a 503 with
 * the registration error in the body.
 */
async function wireWorkflowRuntime(args: WireWorkflowRuntimeArgs): Promise<void> {
  // The descriptors collected from modules + plugins use core's structural
  // types; the manifest builder needs the concrete `EventFilterRuntimeEntry`
  // shape. They share identity (`{ id, eventType, ... }`); the cast is
  // safe because both ends control the contract — see architecture doc
  // §10.1 / §21.19.
  const filterEntries = args.collectedFilters as ReadonlyArray<EventFilterRuntimeEntry>

  const manifest = await buildManifest({
    projectId: args.projectId,
    environment: args.environment,
    workflows: args.collectedWorkflows.map((w) => ({ id: w.id })),
    eventFilters: filterEntries,
  })

  await args.driver.registerManifest({
    environment: args.environment,
    manifest,
  })

  // Install one EventBus subscriber per unique eventType. Each subscriber
  // forwards the envelope through `driver.ingestEvent(...)`, which
  // routes through the same predicate/mapper machinery the HTTP
  // ingest path uses (see architecture doc §15).
  const eventTypes = new Set(filterEntries.map((f) => f.eventType))
  for (const eventType of eventTypes) {
    args.eventBus.subscribe(eventType, async (envelope: EventEnvelope) => {
      const stamped = ensureMetadataEventId(envelope)
      try {
        await args.driver.ingestEvent({
          environment: args.environment,
          envelope: stamped,
        })
      } catch (err) {
        // Subscribers are observers per the EventBus contract — a misbehaving
        // driver / network glitch must not break the emitter. The driver's
        // own error reporting (logger calls + counter increments) surfaces
        // the failure for ops; we swallow here to preserve the bus contract.
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[voyant] workflow forwarder for "${eventType}" failed: ${message}`)
      }
    })
  }
}

/**
 * Adapt the framework's `ModuleContainer` (which has `register`) to a
 * read-only `ServiceResolver` view (`resolve` + `has` only). This is
 * what driver factories receive in their `services` dep.
 */
function containerToServiceResolver(container: ModuleContainer): {
  resolve<T>(name: string): T
  has(name: string): boolean
} {
  return {
    resolve<T>(name: string): T {
      return container.resolve<T>(name)
    },
    has(name: string): boolean {
      return container.has(name)
    },
  }
}

/**
 * Adapt the framework's optional `LoggerProvider` to the structural
 * `DriverLogger` shape `(level, msg, data?) => void`. When no logger
 * is configured, the adapter routes through `console`.
 */
function makeFrameworkLogger(
  loggerProvider: VoyantAppConfig["logger"] | undefined,
): (level: "debug" | "info" | "warn" | "error", msg: string, data?: object) => void {
  void loggerProvider
  return (level, msg, data) => {
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log
    if (data !== undefined) fn(`[voyant] ${msg}`, data)
    else fn(`[voyant] ${msg}`)
  }
}

function ensureMetadataEventId(envelope: EventEnvelope): EventEnvelope {
  const metadata = envelope.metadata
  if (
    metadata !== undefined &&
    metadata !== null &&
    typeof metadata === "object" &&
    typeof (metadata as { eventId?: unknown }).eventId === "string" &&
    ((metadata as { eventId: string }).eventId.length ?? 0) > 0
  ) {
    return envelope
  }
  const eventId = `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")}`
  return {
    ...envelope,
    metadata: {
      ...(metadata ?? {}),
      eventId,
    },
  } as EventEnvelope
}
