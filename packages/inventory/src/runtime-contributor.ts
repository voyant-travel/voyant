import {
  type ActionLedgerInventoryDriftRuntime,
  actionLedgerInventoryDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import {
  type BookingsInventoryRuntime,
  bookingsInventoryRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import { catalogInventoryRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  type FinanceInventoryPaymentPolicyRuntime,
  financeInventoryPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { and, eq } from "drizzle-orm"
import { checkProductActionLedgerDrift } from "./action-ledger-drift.js"
import {
  createInventoryPaymentPolicyRuntime,
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "./booking-payment-policy-runtime.js"
import { catalogInventoryRuntimeExtension } from "./catalog-runtime-extension.js"
import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"
import {
  type InventoryRuntime,
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "./runtime-ports.js"
import { productCapabilities, products } from "./schema.js"
import { createInventoryBrochureStandardNodeRuntime } from "./standard-node-brochure-runtime.js"

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
  const brochure = createInventoryBrochureStandardNodeRuntime(host.primitives)
  return {
    [catalogInventoryRuntimeExtensionPort.id]: catalogInventoryRuntimeExtension,
    [actionLedgerInventoryDriftRuntimePort.id]: {
      checkProductDrift: checkProductActionLedgerDrift,
    } satisfies ActionLedgerInventoryDriftRuntime,
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
    [financeInventoryPaymentPolicyRuntimePort.id]: {
      createPaymentPolicyRuntime: createInventoryPaymentPolicyRuntime,
      stampPolicySourceOnBooking,
      readPolicySourceFromInternalNotes,
    } satisfies FinanceInventoryPaymentPolicyRuntime,
  }
}
