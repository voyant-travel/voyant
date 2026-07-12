import { defineToolContextContribution } from "@voyant-travel/tools"
import { productsService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["inventory"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof productsService.listProducts>[0]
    return {
      inventory: {
        listProducts: (query: Parameters<typeof productsService.listProducts>[1]) =>
          productsService.listProducts(db, query),
        getProductById: (id: string) => productsService.getProductById(db, id),
      },
    }
  },
})
