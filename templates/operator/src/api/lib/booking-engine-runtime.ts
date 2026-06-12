/**
 * Process-local SourceAdapterRegistry + OwnedBookingHandlerRegistry
 * for the catalog booking engine. Source adapter wiring stays here; owned
 * vertical booking handlers live in focused registration modules.
 */

import {
  createSourceAdapterRegistry,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"
import { createVoyantConnectSourceAdapter } from "@voyantjs/connect-adapter"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import type { Context } from "hono"

import {
  createConnectCruiseSourceAdapter,
  skipCruiseConnectDocuments,
} from "./connect-cruise-source"
import { createGeoNameResolver } from "./geo-resolver"
import { createOwnedBookingHandlersRegistry } from "./owned-booking-handlers"

let _registry: SourceAdapterRegistry | undefined
let _ownedHandlers: OwnedBookingHandlerRegistry | undefined

/**
 * Returns the (lazy-initialized) booking-engine registry. The first
 * caller per process creates the registry and conditionally registers
 * each adapter; subsequent callers get the same instance.
 */
export function getBookingEngineRegistry(env: BookingEngineEnv): SourceAdapterRegistry {
  if (!_registry) {
    const registry = createSourceAdapterRegistry()
    if (env.CATALOG_DEMO_API_URL) {
      registry.register(createDemoCatalogAdapter({ baseUrl: env.CATALOG_DEMO_API_URL }))
    }
    registerVoyantConnectAdapter(registry, env)
    _registry = registry
  }
  return _registry
}

/**
 * Returns the (lazy-initialized) owned-handler registry. Phase A registers
 * products plus retained resale verticals such as accommodations and cruises.
 */
export function getOwnedBookingHandlerRegistry(env: BookingEngineEnv): OwnedBookingHandlerRegistry {
  if (!_ownedHandlers) {
    _ownedHandlers = createOwnedBookingHandlersRegistry(env, () => getBookingEngineRegistry(env))
  }
  return _ownedHandlers
}

export interface BookingEngineEnv {
  CATALOG_DEMO_API_URL?: string
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CONNECT_API_KEY?: string
  VOYANT_CONNECT_API_URL?: string
  VOYANT_CONNECT_MARKET?: string
  VOYANT_CONNECT_OPERATOR_ID?: string
  VOYANT_CONNECT_SYNC_LIMIT?: string
}

function registerVoyantConnectAdapter(
  registry: SourceAdapterRegistry,
  env: BookingEngineEnv,
): void {
  const apiKey = env.VOYANT_API_KEY ?? env.VOYANT_CONNECT_API_KEY ?? env.VOYANT_CLOUD_API_KEY
  const operatorId = env.VOYANT_CONNECT_OPERATOR_ID
  if (!apiKey && !operatorId) return

  if (!apiKey || !operatorId) {
    console.warn(
      "[booking-engine] incomplete Voyant Connect config; set VOYANT_API_KEY, " +
        "and VOYANT_CONNECT_OPERATOR_ID to enable it.",
    )
    return
  }

  registry.register(
    createVoyantConnectSourceAdapter({
      connect: {
        apiKey,
        operatorId,
        baseUrl: env.VOYANT_CONNECT_API_URL,
      },
      operatorId,
      market: env.VOYANT_CONNECT_MARKET,
      discoverLimit: positiveInteger(env.VOYANT_CONNECT_SYNC_LIMIT) ?? 500,
      // Cruises are sourced through the structured cruise adapter below so the
      // canonical geography survives; skip them on the generic path.
      mapDocument: skipCruiseConnectDocuments,
    }),
  )

  // Structured cruise sourcing — lands sourced cruises in the cruise vertical
  // with facetable geography (waterways / regions / countries + canonical ids).
  registry.register(
    createConnectCruiseSourceAdapter(
      {
        connect: {
          apiKey,
          operatorId,
          baseUrl: env.VOYANT_CONNECT_API_URL,
        },
        operatorId,
      },
      undefined,
      { geo: createGeoNameResolver({ apiKey }) },
    ),
  )
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Convenience helper for route handlers — pulls env from the Hono context and
 * returns the cached source registry.
 */
export function getBookingEngineRegistryFromContext(c: Context): SourceAdapterRegistry {
  const env = c.env as BookingEngineEnv
  return getBookingEngineRegistry(env)
}

/**
 * Convenience helper for route handlers — pulls env from the Hono context and
 * returns the cached owned-handler registry.
 */
export function getOwnedBookingHandlerRegistryFromContext(c: Context): OwnedBookingHandlerRegistry {
  const env = c.env as BookingEngineEnv
  return getOwnedBookingHandlerRegistry(env)
}
