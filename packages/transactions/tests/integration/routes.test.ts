import { describe } from "vitest"
import { DB_AVAILABLE, registerTransactionsRoutesTestHooks } from "./routes.test-support.js"
import { registerOfferAssignmentSuites } from "./routes-offer-assignments.suite.js"
import { registerOfferBundleSuites } from "./routes-offer-bundles.suite.js"
import { registerOfferItemSuites } from "./routes-offer-items.suite.js"
import { registerOfferTravelerSuites } from "./routes-offer-travelers.suite.js"
import { registerOfferSuites } from "./routes-offers.suite.js"
import { registerOrderAssignmentSuites } from "./routes-order-assignments.suite.js"
import { registerOrderItemSuites } from "./routes-order-items.suite.js"
import { registerOrderSuites } from "./routes-orders.suite.js"

describe.skipIf(!DB_AVAILABLE)("Transactions routes (integration)", () => {
  registerTransactionsRoutesTestHooks()
  registerOfferBundleSuites()
  registerOfferSuites()
  registerOfferTravelerSuites()
  registerOfferAssignmentSuites()
  registerOfferItemSuites()
  registerOrderSuites()
  registerOrderAssignmentSuites()
  registerOrderItemSuites()
})
