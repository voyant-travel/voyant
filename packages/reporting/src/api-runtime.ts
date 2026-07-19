import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"
import {
  type ReportingContributionRuntime,
  reportingContributionRuntimePort,
} from "@voyant-travel/reporting-contracts/runtime-port"

import { createReportingRegistryFromGraph } from "./graph-registry.js"
import { createReportingRoutes } from "./routes.js"

export const createReportingApiModule = defineGraphRuntimeFactory(async ({ getPorts, graph }) => {
  const contributions = await getPorts<ReportingContributionRuntime>(
    reportingContributionRuntimePort,
  )
  return {
    module: { name: "reporting" },
    adminRoutes: createReportingRoutes(
      await createReportingRegistryFromGraph({ graph, contributions }),
    ),
  } satisfies ApiModule
})
