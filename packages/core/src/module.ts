import type { ModuleContainer } from "./container.js"
import type { EventBus } from "./events.js"
import type { LinkableDefinition } from "./links.js"

/**
 * Minimum structural shape of a workflow registration as exposed by a module
 * or plugin. Defined here in core so `Module` doesn't have to import the
 * concrete `WorkflowDefinition` from `@voyant-travel/workflows` — that would
 * couple core to the workflows package and risk an import cycle (workflows
 * already depends on core for `ModuleContainer` and similar primitives).
 *
 * `@voyant-travel/workflows`'s concrete `WorkflowDefinition` satisfies this
 * descriptor via TypeScript structural compat. Core treats workflows as
 * opaque beyond `id`; the workflows runtime owns the rest.
 *
 * Same pattern Voyant uses for {@link LinkableDefinition} — the structural
 * contract lives in core, concrete types live in their owning packages.
 */
export type WorkflowScheduleDescriptor = (
  | { readonly cron: string }
  | { readonly every: string | number }
  | { readonly at: string | Date }
) & {
  readonly timezone?: string
  readonly input?: unknown | (() => unknown | Promise<unknown>)
  readonly enabled?: boolean
  readonly overlap?: "skip" | "queue" | "allow"
  readonly environments?: readonly ("production" | "preview" | "development")[]
  readonly name?: string
}

export interface WorkflowConcurrencyDescriptor {
  readonly key?: string | ((input: unknown) => string)
  readonly limit?: number
  readonly strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin"
}

export interface WorkflowManifestConfigDescriptor {
  readonly description?: string
  readonly input?: unknown
  readonly output?: unknown
  readonly defaultRuntime?: "node"
  readonly concurrency?: WorkflowConcurrencyDescriptor
  readonly retry?: unknown
  readonly timeout?: unknown
  readonly schedule?: WorkflowScheduleDescriptor | readonly WorkflowScheduleDescriptor[]
}

export interface WorkflowDescriptor {
  /** Stable workflow identifier (e.g. `"promotions.bulk-reindex-products"`). */
  readonly id: string
  /**
   * Optional manifest-only workflow metadata. Full workflow definitions from
   * `@voyant-travel/workflows` also carry this field, with an additional
   * non-serializable `run` function that the app manifest path ignores.
   */
  readonly config?: WorkflowManifestConfigDescriptor
}

export interface EventFilterManifestDescriptor {
  readonly id: string
  readonly eventType: string
  readonly where?: unknown
  readonly input?: unknown
  readonly payloadHash: string
  readonly targetWorkflowId: string
}

/**
 * Minimum structural shape of an event-filter runtime entry as exposed by a
 * module or plugin. Defined here in core for the same reason as
 * {@link WorkflowDescriptor}.
 *
 * `@voyant-travel/workflows`'s concrete `EventFilterRuntimeEntry` (added in PR2)
 * satisfies this descriptor via structural compat.
 */
export interface EventFilterDescriptor {
  /** Filter id, derived from the canonicalized declaration's payloadHash. */
  readonly id: string
  /** Event name the filter targets (matches `EventEnvelope.name`). */
  readonly eventType: string
  /**
   * Optional manifest-only filter metadata. Runtime entries returned from
   * `trigger.on(...)` carry this field; module metadata may also provide it
   * directly when the request app must not import workflow handler bodies.
   */
  readonly manifest?: EventFilterManifestDescriptor
}

/** Executable subscriber selected from a package-owned deployment manifest. */
export interface SubscriberRuntimeDescriptor {
  /** Stable graph subscriber id from the owning package manifest. */
  readonly id: string
  /** Event name registered by this runtime descriptor. */
  readonly eventType: string
  /** Registers the subscriber against the app runtime available at bootstrap. */
  readonly register: BootstrapHandler
}

export interface BootstrapContext<TBindings = unknown> {
  /** Runtime bindings/environment available to the current app/isolate. */
  bindings: TBindings
  /** Shared app container used for explicit runtime registrations. */
  container: ModuleContainer
  /** Canonical event bus for the current app runtime. */
  eventBus: EventBus
}

export type BootstrapHandler<TBindings = unknown> = (
  ctx: BootstrapContext<TBindings>,
) => Promise<void> | void

/**
 * A Voyant module provides domain identity and lifecycle hooks.
 *
 * Server API route composition is layered on top of this contract instead of
 * being part of core. Hono is the sole server API implementation.
 */
export interface Module {
  /** Unique module identifier (e.g., "contacts", "bookings") */
  name: string

  /** Hook handlers keyed by event name (e.g., "contacts.beforeCreate") */
  hooks?: Record<string, (...args: unknown[]) => Promise<void> | void>

  /**
   * Optional service instance registered in the shared app/runtime container
   * under {@link name}.
   *
   * This is intended for explicit runtime wiring in routes, workflows,
   * subscribers, or bootstrap-time registrations. Modules should prefer links
   * and query for cross-module data, and workflows/orchestration for
   * cross-module behavior, rather than treating the container as their default
   * module-to-module integration surface.
   */
  service?: unknown

  /**
   * Optional lazy runtime bootstrap executed once per app/isolate, on the
   * first request where bindings are available.
   *
   * Use this to validate runtime configuration, register app-owned provider
   * instances, or perform other lightweight startup wiring. Do not use it for
   * long-running syncs or scheduled background work.
   */
  bootstrap?: BootstrapHandler

  /**
   * Entities this module exposes for cross-module linking via `defineLink`.
   * Keyed by entity name (e.g. `{ person: ..., organization: ... }`).
   */
  linkable?: Record<string, LinkableDefinition>

  /**
   * Workflows owned by this module. Collected at `createApp()` boot and
   * registered with the configured workflow driver.
   *
   * Prefer manifest-only descriptors (`{ id, config }`) in request apps so
   * module metadata stays importable without pulling workflow handler bodies
   * into the HTTP Worker bundle. Full entries produced by
   * `workflow({ id, run })` remain compatible for self-hosted runtimes and
   * workflow bundle entrypoints. The field type here is structural so core
   * stays workflow-agnostic.
   */
  workflows?: readonly WorkflowDescriptor[]

  /**
   * Event filters owned by this module — declarative bindings of the form
   * `event.name → workflow`, evaluated by the driver's event router at
   * `driver.ingestEvent(...)` time.
   *
   * Concrete entries are produced by `trigger.on(eventName, { ... })` in
   * `@voyant-travel/workflows`. Request apps may also provide manifest-only
   * entries carrying `{ id, eventType, manifest }` so event routing can be
   * registered without importing workflow handler bodies.
   */
  eventFilters?: readonly EventFilterDescriptor[]

  /**
   * Declares that this module's write paths use interactive transactions
   * (`db.transaction(async (tx) => …)`) and therefore require a
   * transaction-capable database adapter at runtime.
   *
   * `createApp()` collects this flag across mounted modules and, on the
   * first request, asserts that the resolved db driver supports
   * interactive transactions. If the resolved driver explicitly reports
   * `dbSupportsTransactions(db) === false` (e.g. `neon-http`), the app
   * throws a clear error naming the offending modules and points at the
   * supported adapters (`createServerlessDbClient` /
   * `createDbClient(url, { adapter: "node" })`).
   *
   * This converts the otherwise-late "No transactions support in
   * neon-http driver" exception thrown on first write into an
   * actionable startup error.
   */
  requiresTransactionalDb?: boolean
}

/**
 * A Voyant extension adds hooks to an existing module without modifying
 * its source code.
 */
export interface Extension {
  /** Unique extension identifier */
  name: string

  /** Which module this extension attaches to (e.g., "suppliers") */
  module: string

  /**
   * Whether this extension's routes run interactive Postgres
   * transactions (`db.transaction(...)`). Extensions mount under their
   * target module's path prefix, so a transacting extension forces the
   * transaction-capable db client onto that module's surface even when
   * the module itself doesn't declare `requiresTransactionalDb` (e.g.
   * catalog-authoring's compose/duplicate routes under
   * `/v1/admin/products`).
   */
  requiresTransactionalDb?: boolean

  /** Hook handlers keyed by event name */
  hooks?: Record<string, (...args: unknown[]) => Promise<void> | void>

  /**
   * Optional lazy runtime bootstrap executed once per app/isolate, on the
   * first request where bindings are available.
   */
  bootstrap?: BootstrapHandler
}
