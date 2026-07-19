import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createCustomerBusinessAccountAdminRoutes } from "./customer-business-onboarding-routes.js"
import { customerBusinessAccountOnboardingRuntimePort } from "./customer-business-onboarding-runtime-port.js"

export const createCustomerBusinessAccountVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => ({
    module: { name: "customer-business-accounts" },
    adminRoutes: createCustomerBusinessAccountAdminRoutes(
      await getPort(customerBusinessAccountOnboardingRuntimePort),
    ),
  }),
)
