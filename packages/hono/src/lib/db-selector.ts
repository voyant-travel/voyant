import type { DbFactory, DbFactorySelector, VoyantBindings } from "../types.js"

export interface PathDbSelectorOptions<TBindings extends VoyantBindings> {
  /** Serves every request not matched by a transactional prefix. */
  defaultFactory: DbFactory<TBindings>
  /** Serves requests under the transactional prefixes. */
  transactionalFactory: DbFactory<TBindings>
  /**
   * Path prefixes (mount paths, no trailing slash) whose requests must
   * receive the transactional client. Matching is exact-or-segment:
   * `/v1/bookings` matches `/v1/bookings` and `/v1/bookings/x`, never
   * `/v1/bookings-export`.
   */
  transactionalPrefixes: readonly string[]
}

/**
 * Path-based {@link DbFactorySelector}: route surfaces that run
 * interactive transactions get the (expensive, WebSocket-backed)
 * transactional factory; everything else gets the cheap default —
 * typically neon-http, which costs no connection handshake. Returns
 * stable factory references so per-request client sharing
 * (`acquireRequestDb`) works across middlewares.
 */
export function createPathDbSelector<TBindings extends VoyantBindings>(
  options: PathDbSelectorOptions<TBindings>,
): DbFactorySelector<TBindings> {
  const transactional = {
    factory: options.transactionalFactory,
    mustSupportTransactions: true,
  }
  const standard = {
    factory: options.defaultFactory,
    mustSupportTransactions: false,
  }
  return {
    select(path: string) {
      const prefixes = [...new Set(options.transactionalPrefixes)]
      for (const prefix of prefixes) {
        if (path === prefix || path.startsWith(`${prefix}/`)) return transactional
      }
      return standard
    },
  }
}
