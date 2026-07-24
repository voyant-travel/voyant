import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { executeCommerceCreate } from "./created-target-command.js"
import { COMMERCE_CREATED_TARGET_POLICIES } from "./created-target-policy.js"
import { PROMOTION_CHANGED_EVENT } from "./promotions/events.js"
import { createOfferMutation, type OfferMutationRuntime } from "./promotions/service.js"
import type { InsertPromotionalOffer } from "./promotions/validation.js"

export async function executePromotionCreateCommand(input: {
  db: PostgresJsDatabase
  context: ActionLedgerRequestContextValues
  input: InsertPromotionalOffer & { idempotencyKey?: string }
  admitted: ToolHandlerActionPolicyContext
  mutationRuntime?: Omit<OfferMutationRuntime, "eventBus" | "source">
  /** Test-only failure seam after the domain rows and before outbox/result append. */
  testHooks?: { afterDomainCreate?: (tx: PostgresJsDatabase, promotionId: string) => Promise<void> }
}) {
  const { idempotencyKey: legacyIdempotencyKey, ...commandInput } = input.input
  return executeCommerceCreate(
    input.db,
    input.context,
    COMMERCE_CREATED_TARGET_POLICIES.promotion,
    legacyIdempotencyKey,
    commandInput,
    input.admitted,
    async (tx) => {
      const mutation = await createOfferMutation(tx, commandInput, input.mutationRuntime)
      await input.testHooks?.afterDomainCreate?.(tx, mutation.row.id)
      await insertOutboxEvents(tx, [
        {
          name: PROMOTION_CHANGED_EVENT,
          data: mutation.event,
          metadata: {
            category: "domain",
            source: "service",
            eventId: promotionCreatedEventId(mutation.row.id),
          },
        },
      ])
      return { id: mutation.row.id }
    },
  )
}

export function promotionCreatedEventId(promotionId: string): string {
  return `evt_commerce_promotion_created_${promotionId}`
}
