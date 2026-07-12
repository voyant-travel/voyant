import {
  type BookingsInventoryRuntime,
  bookingsInventoryRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { and, eq } from "drizzle-orm"
import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"
import {
  type InventoryRuntime,
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "./runtime-ports.js"
import { productCapabilities, products } from "./schema.js"

type RuntimePortValue<T> = T | Promise<T>

export interface InventoryRuntimePortContribution {
  inventory: RuntimePortValue<InventoryRuntime>
  brochure: RuntimePortValue<ProductBrochureRoutesOptions>
}

export interface InventoryRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  capabilities: {
    loadInventoryRuntime(): RuntimePortValue<Pick<InventoryRuntimePortContribution, "inventory">>
  }
}

/** Package-owned registration map for Inventory deployment adapters. */
export function createInventoryRuntimePortContribution(
  host: InventoryRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve(host.capabilities.loadInventoryRuntime())
  const brochure = import("./standard-node-brochure-runtime.js").then((module) =>
    module.createInventoryBrochureStandardNodeRuntime(host.primitives),
  )
  return {
    [inventoryRuntimePort.id]: contribution.then((runtime) => runtime.inventory),
    [inventoryBrochureRuntimePort.id]: brochure,
    [bookingsInventoryRuntimePort.id]: {
      resolveProductSnapshot: async (db, productId) => {
        const [product, capabilityRows] = await Promise.all([
          db
            .select()
            .from(products)
            .where(eq(products.id, productId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          db
            .select({ capability: productCapabilities.capability })
            .from(productCapabilities)
            .where(
              and(
                eq(productCapabilities.productId, productId),
                eq(productCapabilities.enabled, true),
              ),
            ),
        ])
        if (!product) return null
        return {
          id: product.id,
          bookingMode: product.bookingMode,
          capabilities: capabilityRows.map((row) => row.capability),
        }
      },
    } satisfies BookingsInventoryRuntime,
  }
}
