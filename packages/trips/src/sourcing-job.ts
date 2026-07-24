import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import { drainTripRequirementSourcing } from "./service-durable-sourcing.js"
import { tripsSourcingJobRuntimePort } from "./sourcing-job-runtime-port.js"
import { createTripRequirementSourcingDeps } from "./sourcing-runtime.js"

export { tripsSourcingJobRuntimePort } from "./sourcing-job-runtime-port.js"

/** Reconcile due package-owned requirement sourcing operations. */
export async function runTripRequirementSourcingJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(tripsSourcingJobRuntimePort)
  const [db, registry, ownedHandlers] = await Promise.all([
    runtime.resolveDb(context.bindings),
    runtime.resolveSourceRegistry(context.bindings),
    runtime.resolveOwnedSearchHandlers(context.bindings),
  ])
  const result = await drainTripRequirementSourcing(
    db,
    createTripRequirementSourcingDeps(registry, ownedHandlers, db),
  )
  if (result.deadLettered > 0) {
    runtime.warn(`[trips-sourcing] ${result.deadLettered} operation(s) exhausted provider retries`)
  }
  if (result.leaseLost > 0) {
    runtime.warn(`[trips-sourcing] ${result.leaseLost} stale worker lease(s) were fenced`)
  }
}
