import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import { relationshipsRouteRuntimePort } from "./runtime-port.js"

export interface RelationshipsRuntimeContributorHost {
  capabilities: Pick<RelationshipsRouteRuntimeOptions, "customFields">
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [relationshipsRouteRuntimePort.id]: {
      customFields: host.capabilities.customFields,
    } satisfies RelationshipsRouteRuntimeOptions,
  }
}
