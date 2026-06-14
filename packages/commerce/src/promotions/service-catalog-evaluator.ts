/**
 * Catalog evaluator adapter — bridges `@voyantjs/catalog`'s
 * `PromotionEvaluationInput` / `PromotionEvaluationOutput` contract to
 * this package's internal evaluator.
 *
 * Wire via:
 *
 *   const deps: QuoteEntityDeps = {
 *     // ...
 *     evaluatePromotions: createCatalogPromotionEvaluator(db),
 *   }
 *
 * Per docs/architecture/promotions-architecture.md §3.6 + §7.1.
 */

import type {
  PromotionEvaluationInput,
  PromotionEvaluationOutput,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"

import { createDrizzleOfferDataSource, evaluateOffersForProduct } from "./service-evaluator.js"

/**
 * Build the `evaluatePromotions` hook the catalog booking engine wires
 * onto `QuoteEntityDeps`. Closes over the request-scoped db.
 */
export function createCatalogPromotionEvaluator(
  db: AnyDrizzleDb,
): (input: PromotionEvaluationInput) => Promise<PromotionEvaluationOutput> {
  const source = createDrizzleOfferDataSource(db)
  return async (input) => {
    const result = await evaluateOffersForProduct(source, input)
    // Shapes are 1:1 between the two `AppliedOffer` / `CodeStatus`
    // declarations — catalog's contract intentionally mirrors the
    // evaluator's so the bridge is just a structural pass-through.
    return {
      applied: result.applied,
      total: result.total,
      codeStatus: result.codeStatus,
    }
  }
}
