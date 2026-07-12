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

export interface InventoryRuntimeContributorHost {
  capabilities: {
    loadInventoryRuntime(): RuntimePortValue<InventoryRuntimePortContribution>
  }
}

/** Package-owned registration map for Inventory deployment adapters. */
export function createInventoryRuntimePortContribution(
  host: InventoryRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve(host.capabilities.loadInventoryRuntime())
  return {
    [inventoryRuntimePort.id]: contribution.then((runtime) => runtime.inventory),
    [inventoryBrochureRuntimePort.id]: contribution.then((runtime) => runtime.brochure),
  }
}
