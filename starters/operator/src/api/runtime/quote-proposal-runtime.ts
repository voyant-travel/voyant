/**
 * Operator (deployment) wiring for the quote-version proposal + Trip-snapshot
 * routes.
 *
 * The route shapes live in `@voyant-travel/quotes`; this file supplies the
 * deployment-specific options the routes need:
 *   - the concrete transactional db (`operatorPostgresDb`),
 *   - the public proposal base URL (`resolvePublicCheckoutBaseUrlFromBindings`),
 *   - the trips reserve/checkout deps (`createReserveTripDeps`/`createStartCheckoutDeps`),
 *   - the public operator profile (operator settings).
 *
 * Swapping the db backend, base-URL resolution, trips deps, or operator-profile
 * source is a change here — never in the route implementations.
 */

import type { EventBus } from "@voyant-travel/core"
import { getOperatorSettings, toPublicOperatorSettings } from "@voyant-travel/operator-settings"
import type { QuoteProposalRoutesOptions } from "@voyant-travel/quotes"
import { relationshipsService } from "@voyant-travel/relationships"
import type { Context } from "hono"
import { operatorPostgresDb } from "./operator-runtime-adapter"
import { resolvePublicCheckoutBaseUrlFromBindings } from "./payment-config"
import {
  createCancelTripComponentsDeps,
  createReserveTripDeps,
  createStartCheckoutDeps,
} from "./trips-runtime"

/** Build the quotes proposal/snapshot route options for this deployment. */
export function createQuoteProposalRoutesOptions(): QuoteProposalRoutesOptions {
  return {
    resolveDb: (c: Context) => operatorPostgresDb(c.get("db")),
    resolvePublicProposalBaseUrl: (c: Context) =>
      resolvePublicCheckoutBaseUrlFromBindings(c.env ?? {}),
    reserveTripDeps: (c: Context) => createReserveTripDeps(c),
    startCheckoutDeps: (c: Context) => createStartCheckoutDeps(c),
    cancelTripComponentsDeps: (c: Context) => createCancelTripComponentsDeps(c),
    resolveOperatorProfile: async (db) => {
      const operatorSettings = await getOperatorSettings(db)
      return operatorSettings ? toPublicOperatorSettings(operatorSettings) : null
    },
    recordPublicProposalFeedback: async (db, input, c) => {
      const activity = await db.transaction(async (tx) => {
        const row = await relationshipsService.createActivity(tx as never, {
          subject: "Customer requested proposal edits",
          type: "note",
          status: "done",
          completedAt: new Date().toISOString(),
          description: input.message,
        })
        if (!row) throw new Error("Failed to record proposal feedback activity")
        await relationshipsService.createActivityLink(tx as never, row.id, {
          entityType: "quote",
          entityId: input.quoteId,
          role: "primary",
        })
        return { id: row.id }
      })

      await getEventBus(c)?.emit(
        "quote.proposal_feedback.requested",
        {
          quoteId: input.quoteId,
          quoteVersionId: input.quoteVersionId,
          activityId: activity.id,
          message: input.message,
          proposalUrl: input.proposalUrl,
        },
        { category: "domain", source: "route" },
      )

      return activity
    },
  }
}

function getEventBus(c: Context): EventBus | undefined {
  return (c.var as { eventBus?: EventBus }).eventBus
}
