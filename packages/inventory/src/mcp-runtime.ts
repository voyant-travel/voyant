import { defineToolContextContribution } from "@voyant-travel/tools"
import { inventoryExtrasService } from "./extras/service.js"
import { productsService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["inventory", "inventoryExtras"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof productsService.listProducts>[0]
    return {
      inventory: {
        listProducts: (query: Parameters<typeof productsService.listProducts>[1]) =>
          productsService.listProducts(db, query),
        getProductById: (id: string) => productsService.getProductById(db, id),
      },
      inventoryExtras: {
        listProductExtras: (
          input: Parameters<typeof inventoryExtrasService.listProductExtras>[1],
        ) => inventoryExtrasService.listProductExtras(db, input),
        getProductExtraById: (id: string) => inventoryExtrasService.getProductExtraById(db, id),
        createProductExtra: (
          input: Parameters<typeof inventoryExtrasService.createProductExtra>[1],
        ) => inventoryExtrasService.createProductExtra(db, input),
        updateProductExtra: ({ id, ...input }: { id: string; [key: string]: unknown }) =>
          inventoryExtrasService.updateProductExtra(
            db,
            id,
            input as Parameters<typeof inventoryExtrasService.updateProductExtra>[2],
          ),
        listOptionExtraConfigs: (
          input: Parameters<typeof inventoryExtrasService.listOptionExtraConfigs>[1],
        ) => inventoryExtrasService.listOptionExtraConfigs(db, input),
        getOptionExtraConfigById: (id: string) =>
          inventoryExtrasService.getOptionExtraConfigById(db, id),
        createOptionExtraConfig: (
          input: Parameters<typeof inventoryExtrasService.createOptionExtraConfig>[1],
        ) => inventoryExtrasService.createOptionExtraConfig(db, input),
        updateOptionExtraConfig: ({ id, ...input }: { id: string; [key: string]: unknown }) =>
          inventoryExtrasService.updateOptionExtraConfig(
            db,
            id,
            input as Parameters<typeof inventoryExtrasService.updateOptionExtraConfig>[2],
          ),
      },
    }
  },
})
