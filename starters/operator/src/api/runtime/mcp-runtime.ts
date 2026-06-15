/**
 * Operator (deployment) wiring for the trips agent tool surface.
 *
 * The generic tool-dispatch route + the trips command tools live in
 * `@voyant-travel/trips/mcp` (`createTripMcpRoutes`). This file supplies the
 * deployment-specific options:
 *   - how to build the per-request `McpToolContext` (actor / tenant / scope),
 *   - how to bind the trips MCP services to this deployment's db + dependency
 *     wiring (`createOperatorTripsRoutesOptions`).
 *
 * The route mounts at `/v1/admin/mcp` via the `"operator/mcp"` composition
 * entry.
 */
import {
  createTripMcpRoutes,
  type McpToolContext,
  type TripsMcpServices,
  tripsService,
} from "@voyant-travel/trips"
import type { Context, Hono } from "hono"

import { DEFAULT_SLICES } from "../lib/catalog-runtime"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

/** Build the trips MCP admin routes wired with this deployment's options. */
export function buildMcpAdminRoutes(): Hono {
  return createTripMcpRoutes({
    buildContext: buildToolContext,
    buildTripsServices: createTripsMcpServices,
  })
}

function buildToolContext(c: Context): McpToolContext {
  const env = c.env as CloudflareBindings & { TENANT_ID?: string }
  const actor = (c.var.actor ?? "staff") as McpToolContext["actor"]
  const audience: McpToolContext["defaultScope"]["audience"] = actor === "staff" ? "staff" : actor
  const locale = DEFAULT_SLICES[0]?.locale ?? "en-GB"
  return {
    actor,
    tenantId: env.TENANT_ID ?? "default",
    defaultScope: { locale, audience, market: "default", actor },
  }
}

function createTripsMcpServices(c: Context): TripsMcpServices {
  const options = createOperatorTripsRoutesOptions()
  return {
    createTrip: (input) => tripsService.createTrip(c.var.db, input),
    addComponent: (input) => tripsService.addComponent(c.var.db, input),
    removeComponent: (componentId) => tripsService.removeComponent(c.var.db, componentId),
    priceTrip: (input) => {
      const deps = resolveDeps(c, options.priceTripDeps)
      if (!deps) throw new Error("Trips price dependencies are not configured")
      return tripsService.priceTrip(c.var.db, input, deps)
    },
    reserveTrip: (input) => {
      const deps = resolveDeps(c, options.reserveTripDeps)
      if (!deps) throw new Error("Trips reserve dependencies are not configured")
      return tripsService.reserveTrip(c.var.db, input, deps)
    },
  }
}

function resolveDeps<T>(c: Context, deps: T | ((c: Context) => T | undefined) | undefined) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | undefined)(c)
}
