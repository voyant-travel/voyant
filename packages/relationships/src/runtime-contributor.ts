import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import { relationshipsRouteRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface RelationshipsRuntimePortContribution {
  relationshipsRoutes: RuntimePortValue<RelationshipsRouteRuntimeOptions>
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  contribution: RelationshipsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [relationshipsRouteRuntimePort.id]: contribution.relationshipsRoutes }
}
