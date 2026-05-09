import type { ModuleContainer } from "./container.js"
import type { EventBus } from "./events.js"
import type { LinkableDefinition } from "./links.js"

/**
 * Minimum structural shape of a workflow registration as exposed by a module
 * or plugin. Defined here in core so `Module` doesn't have to import the
 * concrete `WorkflowDefinition` from `@voyantjs/workflows` — that would
 * couple core to the workflows package and risk an import cycle (workflows
 * already depends on core for `ModuleContainer` and similar primitives).
 *
 * `@voyantjs/workflows`'s concrete `WorkflowDefinition` satisfies this
 * descriptor via TypeScript structural compat. Core treats workflows as
 * opaque beyond `id`; the workflows runtime owns the rest.
 *
 * Same pattern Voyant uses for {@link LinkableDefinition} — the structural
 * contract lives in core, concrete types live in their owning packages.
 */
export interface WorkflowDescriptor {
  /** Stable workflow identifier (e.g. `"promotions.bulk-reindex-products"`). */
  readonly id: string
}

/**
 * Minimum structural shape of an event-filter runtime entry as exposed by a
 * module or plugin. Defined here in core for the same reason as
 * {@link WorkflowDescriptor}.
 *
 * `@voyantjs/workflows`'s concrete `EventFilterRuntimeEntry` (added in PR2)
 * satisfies this descriptor via structural compat.
 */
export interface EventFilterDescriptor {
  /** Filter id, derived from the canonicalized declaration's payloadHash. */
  readonly id: string
  /** Event name the filter targets (matches `EventEnvelope.name`). */
  readonly eventType: string
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
 * Transport adapters such as Hono or Next.js are layered on top of this
 * contract instead of being part of core.
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
   * Concrete entries are produced by `workflow({ id, run })` in
   * `@voyantjs/workflows`; the field type here is the structural
   * {@link WorkflowDescriptor} so core stays workflow-agnostic.
   */
  workflows?: readonly WorkflowDescriptor[]

  /**
   * Event filters owned by this module — declarative bindings of the form
   * `event.name → workflow`, evaluated by the driver's event router at
   * `driver.ingestEvent(...)` time.
   *
   * Concrete entries are produced by `trigger.on(eventName, { ... })` in
   * `@voyantjs/workflows`; the field type here is the structural
   * {@link EventFilterDescriptor} for the same cycle-avoidance reason as
   * {@link workflows} above.
   */
  eventFilters?: readonly EventFilterDescriptor[]
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

  /** Hook handlers keyed by event name */
  hooks?: Record<string, (...args: unknown[]) => Promise<void> | void>

  /**
   * Optional lazy runtime bootstrap executed once per app/isolate, on the
   * first request where bindings are available.
   */
  bootstrap?: BootstrapHandler
}
