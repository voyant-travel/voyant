/**
 * `SourceAdapterRegistry` — process-local map keyed by `connection_id` that
 * the booking engine and channel-push pipeline consult when dispatching a
 * quote / book / cancel / push call.
 *
 * Templates wire the registry at process start, registering one adapter
 * instance per upstream connection. Two connections of the same kind
 * (e.g. TUI dev + TUI prod, or two different Voyant Connect peers) get
 * two registry entries with two distinct `connection_id`s — different
 * credentials, different rate buckets, different `channel_id` mappings.
 *
 * `kind` remains a useful secondary index — "list all adapters of this
 * kind" supports rotate-to-next-available policies and admin debug
 * surfaces. But routing dispatches by `connection_id` because that's
 * what the data carries (provenance.source_connection_id on sourced
 * rows, channels.id on outbound mappings).
 *
 * Per channel-push-architecture §3.1 and catalog-booking-engine §4.
 */

import type { SourceAdapter } from "../adapter/contract.js"

import { NoAdapterRegisteredError } from "./errors.js"

/**
 * One registry entry. `connectionId` is the typed-id key (the row in
 * whichever table holds the connection record — `channels` for outbound,
 * the catalog plane's connection store for inbound). For adapters with
 * no upstream connection record (e.g. the demo adapter at boot), pass a
 * stable synthetic id like `"default:<kind>"`.
 */
export interface RegisteredAdapter {
  connectionId: string
  adapter: SourceAdapter
}

export interface SourceAdapterRegistry {
  /**
   * Register an adapter under a connection id. The connection id is the
   * primary key — re-registering the same connection id replaces the
   * previous adapter (used at hot-reload time). Production registrations
   * happen once at process start, one entry per upstream connection.
   */
  register(connectionId: string, adapter: SourceAdapter): void

  /**
   * Backward-compat overload — register an adapter without an explicit
   * connection id. Stored under the synthetic id `"default:<kind>"`.
   * Use this for single-deployment adapters where there's no separate
   * connection record (e.g. demo adapters, single-tenant integrations).
   * New code paths that route per-connection should prefer the explicit
   * `register(connectionId, adapter)` form.
   */
  register(adapter: SourceAdapter): void

  /**
   * Resolve by connection id. Hot path for the booking engine (sourced
   * bookings) and the channel-push pipeline (outbound dispatches).
   * Returns `undefined` when no adapter is registered.
   */
  resolveByConnection(connectionId: string): SourceAdapter | undefined

  /** Like `resolveByConnection` but throws `NoAdapterRegisteredError` on miss. */
  resolveByConnectionOrThrow(connectionId: string): SourceAdapter

  /**
   * Resolve by source kind. Returns the FIRST adapter registered for this
   * kind. Useful for legacy dispatch paths that don't yet thread a
   * connection id, and for the common single-connection-per-kind case.
   * New code that supports multiple connections per kind should use
   * `byKind` to pick deliberately.
   */
  resolveOrThrow(sourceKind: string): SourceAdapter

  /**
   * Returns every adapter registered for this kind, paired with its
   * connection id. Order is registration order. Use for "rotate to next
   * available connection" policies and admin debug surfaces.
   */
  byKind(sourceKind: string): ReadonlyArray<RegisteredAdapter>

  /** Returns the registered connection ids. */
  connections(): ReadonlyArray<string>

  /** Returns the registered source kinds. */
  kinds(): ReadonlyArray<string>

  /** True iff a connection id is registered. */
  has(connectionId: string): boolean

  /** True iff at least one adapter of this kind is registered. */
  hasKind(sourceKind: string): boolean
}

/**
 * Construct a fresh registry. Templates create one at process start and
 * pass it to the booking-engine route handlers + channel-push wiring.
 */
export function createSourceAdapterRegistry(): SourceAdapterRegistry {
  const byConnection = new Map<string, SourceAdapter>()
  const kindIndex = new Map<string, Set<string>>()

  function indexAdd(kind: string, connectionId: string): void {
    let set = kindIndex.get(kind)
    if (!set) {
      set = new Set()
      kindIndex.set(kind, set)
    }
    set.add(connectionId)
  }

  function indexRemove(kind: string, connectionId: string): void {
    const set = kindIndex.get(kind)
    if (!set) return
    set.delete(connectionId)
    if (set.size === 0) kindIndex.delete(kind)
  }

  function register(arg1: string | SourceAdapter, arg2?: SourceAdapter): void {
    let connectionId: string
    let adapter: SourceAdapter
    if (typeof arg1 === "string") {
      if (!arg2) {
        throw new TypeError("register(connectionId, adapter): adapter argument is required")
      }
      connectionId = arg1
      adapter = arg2
    } else {
      adapter = arg1
      connectionId = `default:${adapter.kind}`
    }

    const previous = byConnection.get(connectionId)
    if (previous) {
      indexRemove(previous.kind, connectionId)
    }
    byConnection.set(connectionId, adapter)
    indexAdd(adapter.kind, connectionId)
  }

  function resolveByConnection(connectionId: string): SourceAdapter | undefined {
    return byConnection.get(connectionId)
  }

  function resolveByConnectionOrThrow(connectionId: string): SourceAdapter {
    const adapter = byConnection.get(connectionId)
    if (!adapter) throw new NoAdapterRegisteredError(connectionId)
    return adapter
  }

  function byKind(sourceKind: string): ReadonlyArray<RegisteredAdapter> {
    const set = kindIndex.get(sourceKind)
    if (!set || set.size === 0) return []
    const out: RegisteredAdapter[] = []
    for (const connectionId of set) {
      const adapter = byConnection.get(connectionId)
      if (adapter) out.push({ connectionId, adapter })
    }
    return out
  }

  function resolveOrThrow(sourceKind: string): SourceAdapter {
    const set = kindIndex.get(sourceKind)
    if (!set || set.size === 0) throw new NoAdapterRegisteredError(sourceKind)
    const first = set.values().next().value
    if (!first) throw new NoAdapterRegisteredError(sourceKind)
    const adapter = byConnection.get(first)
    if (!adapter) throw new NoAdapterRegisteredError(sourceKind)
    return adapter
  }

  return {
    register: register as SourceAdapterRegistry["register"],
    resolveByConnection,
    resolveByConnectionOrThrow,
    resolveOrThrow,
    byKind,
    connections() {
      return [...byConnection.keys()]
    },
    kinds() {
      return [...kindIndex.keys()]
    },
    has(connectionId) {
      return byConnection.has(connectionId)
    },
    hasKind(sourceKind) {
      const set = kindIndex.get(sourceKind)
      return !!set && set.size > 0
    },
  }
}
