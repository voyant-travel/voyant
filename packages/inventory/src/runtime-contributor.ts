import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"
import {
  type InventoryRuntime,
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "./runtime-ports.js"

type RuntimePortValue<T> = T | Promise<T>

export interface InventoryRuntimePortContribution {
  inventory: RuntimePortValue<InventoryRuntime>
  brochure: RuntimePortValue<ProductBrochureRoutesOptions>
}

/** Package-owned registration map for Inventory deployment adapters. */
export function createInventoryRuntimePortContribution(
  contribution: InventoryRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [inventoryRuntimePort.id]: contribution.inventory,
    [inventoryBrochureRuntimePort.id]: contribution.brochure,
  }
}
