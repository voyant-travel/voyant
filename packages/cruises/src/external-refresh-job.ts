import { definePort, type VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import type { ExternalCruiseCatalogRefreshResult } from "./service-external-refresh.js"

export interface CruisesExternalRefreshJobRuntime {
  run(): Promise<ExternalCruiseCatalogRefreshResult>
}

export const cruisesExternalRefreshJobRuntimePort = definePort<CruisesExternalRefreshJobRuntime>({
  id: "cruises.external-refresh-job",
  test(runtime) {
    if (!runtime || typeof runtime.run !== "function") {
      throw new Error("cruises.external-refresh-job provider must implement run().")
    }
  },
})

/** Refresh the selected deployment's external cruise projections. */
export async function runCruisesExternalCatalogRefreshJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(cruisesExternalRefreshJobRuntimePort)
  await runtime.run()
}
