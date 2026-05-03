/**
 * `SourceAdapterRegistry` — process-local map keyed by `source.kind` that
 * the booking engine consults when dispatching a quote / book / cancel.
 *
 * Templates wire the registry at process start, registering whichever
 * adapters their deployment supports (the demo adapter, Voyant Connect,
 * Hotelbeds, an operator-built GDS connector). The booking engine reads
 * the registry on every dispatch and fails with `NoAdapterRegisteredError`
 * if a row's `source.kind` doesn't have a registered handler.
 *
 * The registry is intentionally a thin wrapper over `Map<string,
 * SourceAdapter>`. Adapters carry their own credentials, HTTP clients,
 * and DB handles through their constructors; the registry just stores
 * the wired instances.
 *
 * Not a DI container: there is no scoping, no factory resolution, no
 * lifetime management. Per architecture §4 of
 * `docs/architecture/catalog-booking-engine.md`.
 */

import type { SourceAdapter } from "../adapter/contract.js"

import { NoAdapterRegisteredError } from "./errors.js"

export interface SourceAdapterRegistry {
  /**
   * Register an adapter under its declared `kind`. Re-registering the
   * same kind replaces the previous adapter — used at hot-reload time
   * in dev. Production registrations happen once at process start.
   */
  register(adapter: SourceAdapter): void

  /**
   * Retrieve the adapter for a given source kind. Returns `undefined`
   * when no adapter is registered; callers typically prefer `resolveOrThrow`
   * for non-recoverable dispatches.
   */
  get(sourceKind: string): SourceAdapter | undefined

  /**
   * Like `get` but throws `NoAdapterRegisteredError` when no adapter
   * matches. Use this in the booking engine's hot dispatch paths.
   */
  resolveOrThrow(sourceKind: string): SourceAdapter

  /**
   * Returns the registered source kinds. Used by the operator template's
   * `/v1/admin/catalog/sources` debug surface and integration tests.
   */
  kinds(): ReadonlyArray<string>

  /** Returns `true` iff an adapter is registered for the given kind. */
  has(sourceKind: string): boolean
}

/**
 * Construct a fresh registry. Templates create one at process start and
 * pass it to the booking-engine route handlers.
 */
export function createSourceAdapterRegistry(): SourceAdapterRegistry {
  const adapters = new Map<string, SourceAdapter>()

  return {
    register(adapter) {
      adapters.set(adapter.kind, adapter)
    },
    get(sourceKind) {
      return adapters.get(sourceKind)
    },
    resolveOrThrow(sourceKind) {
      const adapter = adapters.get(sourceKind)
      if (!adapter) throw new NoAdapterRegisteredError(sourceKind)
      return adapter
    },
    kinds() {
      return [...adapters.keys()]
    },
    has(sourceKind) {
      return adapters.has(sourceKind)
    },
  }
}
