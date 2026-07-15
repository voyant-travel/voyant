import type { EventBus } from "@voyant-travel/core"
import { defineToolContextContribution } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { pricingService } from "./pricing/service.js"
import { promotionsService } from "./promotions/service.js"
import { sellabilityService } from "./sellability/service.js"
import type { CommerceToolServices } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["commerce"],
  contribute({ request, context }) {
    const db = context.db as PostgresJsDatabase
    const c = request as Context
    const eventBus = (c.var as { eventBus?: EventBus }).eventBus
    const mutationRuntime = { eventBus }
    const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
    const commerce: CommerceToolServices = {
      async resolveSellability(input) {
        return json(await sellabilityService.resolve(db, input))
      },
      async listCancellationPolicies(input) {
        return json(await pricingService.listCancellationPolicies(db, input))
      },
      async getCancellationPolicy(id) {
        return json(await pricingService.getCancellationPolicyById(db, id))
      },
      async createCancellationPolicy(input) {
        return json(await pricingService.createCancellationPolicy(db, input))
      },
      async updateCancellationPolicy(id, input) {
        return json(await pricingService.updateCancellationPolicy(db, id, input))
      },
      async listPriceCatalogs(input) {
        return json(await pricingService.listPriceCatalogs(db, input))
      },
      async getPriceCatalog(id) {
        return json(await pricingService.getPriceCatalogById(db, id))
      },
      async createPriceCatalog(input) {
        return json(await pricingService.createPriceCatalog(db, input))
      },
      async updatePriceCatalog(id, input) {
        return json(await pricingService.updatePriceCatalog(db, id, input))
      },
      async listPromotions(input) {
        return json(await promotionsService.listOffers(db, input))
      },
      async getPromotion(id) {
        return json(await promotionsService.getOfferById(db, id))
      },
      async createPromotion(input) {
        return json(await promotionsService.createOffer(db, input, mutationRuntime))
      },
      async updatePromotion(id, input) {
        return json(await promotionsService.updateOffer(db, id, input, mutationRuntime))
      },
      async archivePromotion(id) {
        return json(await promotionsService.archiveOffer(db, id, mutationRuntime))
      },
    }
    return { commerce }
  },
})
