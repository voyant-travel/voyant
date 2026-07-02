/**
 * Operator wiring for the in-deployment MCP server.
 *
 * The framework tool contract (`@voyant-travel/tools`) and the MCP transport
 * (`@voyant-travel/mcp`) are generic; this file supplies the deployment
 * specifics: which tools to register, and how to build the per-request
 * `ToolContext` — including binding the trips service to this request's `db` +
 * dependency wiring.
 *
 * The route mounts at `/v1/admin/mcp` via the `"operator/mcp"` composition entry.
 */
import { createMcpHonoApp } from "@voyant-travel/mcp"
import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { type TripsToolServices, tripsService, tripsTools } from "@voyant-travel/trips"
import type { Context, Hono } from "hono"

import { DEFAULT_SLICES } from "../lib/catalog-runtime"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

/** Build the MCP admin routes wired with this deployment's tools + context. */
export function buildMcpAdminRoutes(): Hono {
  const registry = createToolRegistry()
  registry.registerAll(tripsTools)
  return createMcpHonoApp({ registry, buildContext: buildToolContext })
}

function buildToolContext(c: Context): ToolContext & { trips: TripsToolServices } {
  const env = c.env as CloudflareBindings & { TENANT_ID?: string }
  const actor = (c.var.actor ?? "staff") as ToolContext["actor"]
  const audience = (c.var.audience ?? actor) as ToolContext["audience"]
  const locale = DEFAULT_SLICES[0]?.locale ?? "en-GB"
  return {
    db: c.var.db,
    actor,
    audience,
    tenantId: env.TENANT_ID ?? "default",
    resolverScope: { locale, audience, market: "default", actor },
    trips: createTripsToolServices(c),
  }
}

function createTripsToolServices(c: Context): TripsToolServices {
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
