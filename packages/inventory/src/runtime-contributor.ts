import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
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
  }
}
