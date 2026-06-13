import type { PromotionalOffer } from "../../src/schema.js"
import type { OfferDataSource, OfferEvaluationContext } from "../../src/service-evaluator.js"
import type { PromotionalOfferConditions, PromotionalOfferScope } from "../../src/validation.js"

let offerSeq = 0

export function makeOffer(overrides: Partial<PromotionalOffer> = {}): PromotionalOffer {
  offerSeq += 1
  const id = overrides.id ?? `pofr_${offerSeq.toString().padStart(6, "0")}`
  return {
    id,
    name: `Offer ${offerSeq}`,
    slug: `offer-${offerSeq}`,
    description: null,
    discountType: "percentage",
    discountPercent: "10",
    discountAmountCents: null,
    currency: null,
    scope: { kind: "global" } satisfies PromotionalOfferScope,
    conditions: {} satisfies PromotionalOfferConditions,
    validFrom: null,
    validUntil: null,
    code: null,
    stackable: false,
    active: true,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

interface SourceConfig {
  auto?: PromotionalOffer[]
  coded?: PromotionalOffer[]
  productLinks?: Record<string, string[]>
}

export function makeSource(config: SourceConfig = {}): OfferDataSource {
  const auto = config.auto ?? []
  const coded = config.coded ?? []
  const productLinks = config.productLinks ?? {}
  return {
    async fetchActiveAutoCandidates() {
      return auto
    },
    async findActiveOfferByCode(code) {
      return (
        coded.find(
          (offer) => offer.code != null && offer.code.toLowerCase() === code.toLowerCase(),
        ) ?? null
      )
    },
    async productMatchesAnyScope(productId, offerIds) {
      const linked = new Set(productLinks[productId] ?? [])
      return new Set(offerIds.filter((id) => linked.has(id)))
    },
  }
}

export const baseCtx = (
  overrides: Partial<OfferEvaluationContext> = {},
): OfferEvaluationContext => ({
  productId: "prod_a",
  slice: { audience: "customer", market: "mkt_uk" },
  basePriceCents: 10_000,
  baseCurrency: "USD",
  ...overrides,
})
