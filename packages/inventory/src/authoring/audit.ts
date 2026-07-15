import type { Context } from "hono"

import {
  appendProductMutationLedgerEntry,
  type ProductLedgerMutationAction,
} from "../action-ledger.js"
import { emitProductContentChanged } from "../events.js"

type LedgerContext = Parameters<typeof appendProductMutationLedgerEntry>[0]

/** Record a fresh graph authoring mutation through the canonical audit/event path. */
export async function recordProductAuthoring(
  // biome-ignore lint/suspicious/noExplicitAny: bridges authoring and MCP Env variants to the canonical ledger Context
  c: Context<any>,
  action: ProductLedgerMutationAction,
  productId: string,
) {
  const verb = action === "duplicate" ? "duplicate" : "compose"
  await appendProductMutationLedgerEntry(c as LedgerContext, {
    action,
    productId,
    changedFields: [],
    subject: "product",
    actionName: `product.${verb}`,
    routeOrToolName: `products.${verb}`,
  })
  await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "product" })
}
