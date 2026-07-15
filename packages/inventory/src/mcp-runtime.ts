import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import type { EventBus } from "@voyant-travel/core"
import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import type { Context } from "hono"
import { emitProductContentChanged } from "./events.js"
import { inventoryExtrasService } from "./extras/service.js"
import { productsService } from "./service.js"
import { getProductContent } from "./service-content.js"
import type { InventoryContentToolServices, InventoryToolServices } from "./tools.js"

export * from "./tools.js"

type InventoryMcpEnv = { Variables: { eventBus?: EventBus } }

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["inventory", "inventoryContent", "inventoryExtras"],
  contribute: ({ request, context, resources }) => {
    const c = request as Context<InventoryMcpEnv>
    const db = context.db as Parameters<typeof productsService.listProducts>[0]
    const eventBus = c.get("eventBus")
    const inventoryContent: InventoryContentToolServices = {
      async getProductContent(input) {
        const runtime = await optionalContentRuntime(resources[catalogContentRuntimePort.id])
        if (!runtime) {
          throw new ToolError(
            "Product content requires the selected catalog.content-runtime port.",
            "MISSING_SERVICE",
            { service: catalogContentRuntimePort.id },
          )
        }
        const result = await getProductContent(
          db,
          input.id,
          {
            preferredLocales: input.preferredLocales ?? [context.resolverScope.locale],
            ...(input.market ? { market: input.market } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
            acceptMachineTranslated: input.acceptMachineTranslated,
          },
          {
            registry: runtime.resolveRegistry(request),
            ...(input.forceFresh ? { forceFresh: true } : {}),
          },
        )
        return result
          ? {
              content: result.content,
              provenance: result.provenance,
              served_locale: result.resolution.served_locale,
              match_kind: result.resolution.match_kind,
              source: result.source,
              served_stale: result.served_stale,
              synthesized: result.synthesized,
              machine_translated: result.machine_translated,
            }
          : null
      },
    }
    const inventory: InventoryToolServices = {
      listProducts: (query) => productsService.listProducts(db, query),
      getProductById: (id) => productsService.getProductById(db, id),
      getProductAggregates: (query) => productsService.getProductAggregates(db, query),
      async createProduct(input) {
        const row = await productsService.createProduct(db, input)
        await eventBus?.emit("product.created", { id: row.id })
        return row
      },
      async updateProduct(id, input) {
        const row = await productsService.updateProduct(db, id, input)
        if (row) {
          await eventBus?.emit("product.updated", { id: row.id })
          await emitProductContentChanged(eventBus, { id: row.id, axis: "product" })
        }
        return row
      },
    }
    return {
      inventory,
      inventoryContent,
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

async function optionalContentRuntime(value: unknown): Promise<CatalogContentRuntime | undefined> {
  const resolved = await Promise.resolve(value)
  if (resolved === undefined) return undefined
  await catalogContentRuntimePort.test(resolved as CatalogContentRuntime)
  return resolved as CatalogContentRuntime
}
