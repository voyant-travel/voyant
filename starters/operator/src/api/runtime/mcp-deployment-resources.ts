/** Deployment resources consumed by package-owned MCP context contributions. */

import { DEFAULT_SLICES } from "@voyant-travel/catalog/standard-node/catalog-runtime"
import type { ToolContext } from "@voyant-travel/tools"
import type { Context } from "hono"
import { resolveNotificationProviders } from "../../lib/notifications"
import { buildCatalogContext } from "../lib/catalog-context"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

export function buildOperatorMcpBaseContext(c: Context): ToolContext {
  const env = c.env as AppBindings & { TENANT_ID?: string }
  const actor = (c.var.actor ?? "staff") as ToolContext["actor"]
  const audience = (c.var.audience ?? actor) as ToolContext["audience"]
  return {
    db: c.var.db,
    actor,
    audience,
    tenantId: env.TENANT_ID ?? "default",
    resolverScope: {
      locale: DEFAULT_SLICES[0]?.locale ?? "en-GB",
      audience,
      market: "default",
      actor,
    },
  }
}

export function buildOperatorMcpResources(c: Context): Readonly<Record<string, unknown>> {
  return {
    catalog: buildCatalogContext(c),
    trips: createOperatorTripsRoutesOptions(),
    notifications: resolveNotificationProviders(c.env as Record<string, unknown>),
  }
}
