import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"
import {
  type ReportingContributionRuntime,
  reportingContributionRuntimePort,
} from "@voyant-travel/reporting-contracts/runtime-port"

import { ReportingRegistry } from "./registry.js"
import { createReportingRoutes } from "./routes.js"

export const createReportingApiModule = defineGraphRuntimeFactory(async ({ getPorts }) => {
  const contributions = await getPorts<ReportingContributionRuntime>(
    reportingContributionRuntimePort,
  )
  return {
    module: { name: "reporting" },
    adminRoutes: createReportingRoutes(new ReportingRegistry(contributions)),
  } satisfies ApiModule
})
