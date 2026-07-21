import type { ModuleContainer } from "./container.js"
import type { EventBus } from "./events.js"
import type { LinkableDefinition } from "./links.js"

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
   * This is intended for explicit runtime wiring in routes,
   * subscribers, or bootstrap-time registrations. Modules should prefer links
   * and query for cross-module data, and subscribers/jobs for cross-module
   * behavior, rather than treating the container as their default
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
