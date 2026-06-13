import { describe } from "vitest"
import { DB_AVAILABLE, registerPricingRoutesTestHooks } from "./routes.test-support.js"
import { registerCancellationSuites } from "./routes-cancellation.suite.js"
import { registerCatalogSuites } from "./routes-catalogs.suite.js"
import { registerLogisticsSuites } from "./routes-logistics.suite.js"
import { registerOptionRuleSuites } from "./routes-option-rules.suite.js"
import { registerPricingCategorySuites } from "./routes-pricing-categories.suite.js"

describe.skipIf(!DB_AVAILABLE)("Pricing Routes Integration", () => {
  registerPricingRoutesTestHooks()
  registerPricingCategorySuites()
  registerCancellationSuites()
  registerCatalogSuites()
  registerOptionRuleSuites()
  registerLogisticsSuites()
})
