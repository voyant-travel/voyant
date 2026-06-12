// agent-quality: file-size exception -- owner: promotions; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
/**
 * Unit tests for the promotions rule evaluator.
 *
 * Pure tests — uses an in-memory `OfferDataSource` fixture, no DB.
 * Covers every branch of the algorithm in §5.2:
 *   - code validation phase + every CodeStatus kind
 *   - scope filter for each kind (including link-table-backed scopes)
 *   - conditions (catalog vs checkout pax behavior)
 *   - currency filter (silent drop for auto, code_not_applicable for code-gated)
 *   - stacking (single non-stackable, pure stackable composition, mixed pick)
 *   - the §10 worked example
 *   - edge cases (fixed_amount cap at base, percentage rounding, empty candidates)
 */

import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import type { PromotionalOffer } from "../../src/schema.js"
import {
  __test__,
  evaluateOffersForProduct,
  type OfferDataSource,
  type OfferEvaluationContext,
} from "../../src/service-evaluator.js"
import type { PromotionalOfferConditions, PromotionalOfferScope } from "../../src/validation.js"

// ---------- Fixtures ----------

let offerSeq = 0
function makeOffer(overrides: Partial<PromotionalOffer> = {}): PromotionalOffer {
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
  /** Auto offers (active, code IS NULL, validity covers `now`). */
  auto?: PromotionalOffer[]
  /** Code-gated offers; the data source's findActiveOfferByCode looks here. */
  coded?: PromotionalOffer[]
  /** Map of `productId → set of offerIds whose link table includes that product`. */
  productLinks?: Record<string, string[]>
}

function makeSource(config: SourceConfig = {}): OfferDataSource {
  const auto = config.auto ?? []
  const coded = config.coded ?? []
  const productLinks = config.productLinks ?? {}
  return {
    async fetchActiveAutoCandidates() {
      return auto
    },
    async findActiveOfferByCode(code) {
      return (
        coded.find((o) => o.code != null && o.code.toLowerCase() === code.toLowerCase()) ?? null
      )
    },
    async productMatchesAnyScope(productId, offerIds) {
      const linked = new Set(productLinks[productId] ?? [])
      return new Set(offerIds.filter((id) => linked.has(id)))
    },
  }
}

const baseCtx = (overrides: Partial<OfferEvaluationContext> = {}): OfferEvaluationContext => ({
  productId: "prod_a",
  slice: { audience: "customer", market: "mkt_uk" },
  basePriceCents: 10_000, // $100.00
  baseCurrency: "USD",
  ...overrides,
})

// ---------- Tests ----------

describe("active auto-offer DB predicate", () => {
  it("encodes both validity-window timestamp comparisons through Drizzle column encoders", () => {
    const date = new Date("2026-05-10T00:00:00.000Z")
    const query = new PgDialect().sqlToQuery(__test__.activeAutoOfferPredicate(date))

    expect(query.sql).toContain('"promotional_offers"."valid_from" <= $2')
    expect(query.sql).toContain('"promotional_offers"."valid_until" >= $3')
    expect(query.params).toEqual([true, "2026-05-10T00:00:00.000Z", "2026-05-10T00:00:00.000Z"])
    expect(query.typings).toEqual(["none", "timestamp", "timestamp"])
  })
})

describe("evaluateOffersForProduct — empty / no-op", () => {
  it("returns nothing when no candidates exist", async () => {
    const result = await evaluateOffersForProduct(makeSource(), baseCtx())
    expect(result.applied).toEqual([])
    expect(result.best).toBeNull()
    expect(result.conditional).toEqual([])
    expect(result.total).toEqual({ discountAppliedCents: 0, discountedPriceCents: 10_000 })
    expect(result.codeStatus).toBeNull()
  })

  it("returns nothing when candidates fail scope (slice mismatch)", async () => {
    const offer = makeOffer({
      scope: { kind: "audiences", audiences: ["partner"] },
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ slice: { audience: "customer", market: "mkt_uk" } }),
    )
    expect(result.applied).toEqual([])
  })
})

describe("scope filter", () => {
  it("global scope matches every (productId, slice)", async () => {
    const offer = makeOffer({ scope: { kind: "global" } })
    const result = await evaluateOffersForProduct(makeSource({ auto: [offer] }), baseCtx())
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.offerId).toBe(offer.id)
  })

  it("products scope matches only when the link table has the product", async () => {
    const offer = makeOffer({ scope: { kind: "products", productIds: ["prod_a"] } })
    const matchedSource = makeSource({ auto: [offer], productLinks: { prod_a: [offer.id] } })
    const unmatchedSource = makeSource({ auto: [offer], productLinks: { prod_b: [offer.id] } })

    expect(
      (await evaluateOffersForProduct(matchedSource, baseCtx({ productId: "prod_a" }))).applied,
    ).toHaveLength(1)
    expect(
      (await evaluateOffersForProduct(unmatchedSource, baseCtx({ productId: "prod_a" }))).applied,
    ).toHaveLength(0)
  })

  it("categories + destinations scope use the same link-table predicate", async () => {
    const catOffer = makeOffer({
      id: "pofr_cat",
      scope: { kind: "categories", categoryIds: ["cat_x"] },
    })
    const destOffer = makeOffer({
      id: "pofr_dest",
      scope: { kind: "destinations", destinationIds: ["dest_y"] },
    })
    const source = makeSource({
      auto: [catOffer, destOffer],
      productLinks: { prod_a: ["pofr_cat", "pofr_dest"] },
    })
    const result = await evaluateOffersForProduct(source, baseCtx({ productId: "prod_a" }))
    // Both apply by scope; whichever has the larger discount wins (here they
    // tie at 10% → first non-stackable picked is fine for this assertion).
    expect(result.applied.length).toBeGreaterThan(0)
  })

  it("markets scope matches when slice.market is in scope.marketIds", async () => {
    const offer = makeOffer({ scope: { kind: "markets", marketIds: ["mkt_uk", "mkt_ie"] } })
    expect(
      (await evaluateOffersForProduct(makeSource({ auto: [offer] }), baseCtx())).applied,
    ).toHaveLength(1)

    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ slice: { audience: "customer", market: "mkt_us" } }),
        )
      ).applied,
    ).toHaveLength(0)
  })

  it("audiences scope matches when slice.audience is in scope.audiences", async () => {
    const offer = makeOffer({
      scope: { kind: "audiences", audiences: ["partner", "supplier"] },
    })
    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ slice: { audience: "partner", market: "mkt_uk" } }),
        )
      ).applied,
    ).toHaveLength(1)
    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ slice: { audience: "customer", market: "mkt_uk" } }),
        )
      ).applied,
    ).toHaveLength(0)
  })

  it("fare-code scope matches booking-line fareCode", async () => {
    const offer = makeOffer({
      scope: { kind: "fare_codes", fareCodes: ["EARLY_BIRD", "PAST_GUEST"] },
    })

    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ fareCode: "EARLY_BIRD" }),
        )
      ).applied,
    ).toHaveLength(1)
    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ fareCode: "STANDARD" }),
        )
      ).applied,
    ).toHaveLength(0)
    expect(
      (await evaluateOffersForProduct(makeSource({ auto: [offer] }), baseCtx())).applied,
    ).toHaveLength(0)
  })

  it("cabin-grade scope matches booking-line cabinGradeCode", async () => {
    const offer = makeOffer({
      scope: { kind: "cabin_grades", cabinGradeCodes: ["SUITE", "BALCONY"] },
    })

    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ cabinGradeCode: "SUITE" }),
        )
      ).applied,
    ).toHaveLength(1)
    expect(
      (
        await evaluateOffersForProduct(
          makeSource({ auto: [offer] }),
          baseCtx({ cabinGradeCode: "OCEANVIEW" }),
        )
      ).applied,
    ).toHaveLength(0)
  })
})

describe("conditions filter — minPax", () => {
  it("catalog-plane (pax undefined): minPax offer surfaces in `conditional`, NOT `applied`", async () => {
    const offer = makeOffer({ conditions: { minPax: 4 }, discountPercent: "5" })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ pax: undefined }),
    )
    expect(result.applied).toEqual([])
    expect(result.conditional).toHaveLength(1)
    expect(result.conditional[0]).toEqual({
      offerId: offer.id,
      offerName: offer.name,
      discountKind: "percentage",
      discountPercent: 5,
      discountAmountCents: null,
      unmet: { kind: "min_pax", required: 4 },
    })
  })

  it("checkout (pax >= minPax): offer applies normally, conditional empty", async () => {
    const offer = makeOffer({ conditions: { minPax: 4 } })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ pax: 4 }),
    )
    expect(result.applied).toHaveLength(1)
    expect(result.conditional).toEqual([])
  })

  it("checkout (pax < minPax): offer is excluded entirely (NOT conditional)", async () => {
    const offer = makeOffer({ conditions: { minPax: 4 } })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ pax: 2 }),
    )
    expect(result.applied).toEqual([])
    expect(result.conditional).toEqual([])
  })

  it("offer with no conditions never appears in conditional", async () => {
    const offer = makeOffer()
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ pax: undefined }),
    )
    expect(result.conditional).toEqual([])
  })

  it("catalog-plane surfaces unknown eligibility flags as conditional offers", async () => {
    const offer = makeOffer({ conditions: { pastGuestOnly: true } })
    const result = await evaluateOffersForProduct(makeSource({ auto: [offer] }), baseCtx())

    expect(result.applied).toEqual([])
    expect(result.conditional[0]?.unmet).toEqual({ kind: "past_guest" })
  })

  it("checkout applies structured eligibility flags when satisfied", async () => {
    const offer = makeOffer({
      conditions: {
        pastGuestOnly: true,
        soloTravelerOnly: true,
        childTravelerOnly: true,
        familyOnly: true,
      },
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({
        eligibility: {
          pastGuest: true,
          soloTraveler: true,
          hasChildTraveler: true,
          family: true,
        },
      }),
    )

    expect(result.applied).toHaveLength(1)
    expect(result.conditional).toEqual([])
  })

  it("checkout excludes structured eligibility flags when unsatisfied", async () => {
    const offer = makeOffer({ conditions: { familyOnly: true } })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ eligibility: { family: false } }),
    )

    expect(result.applied).toEqual([])
    expect(result.conditional).toEqual([])
  })

  it("soloTravelerOnly can be satisfied from pax", async () => {
    const offer = makeOffer({ conditions: { soloTravelerOnly: true } })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ pax: 1 }),
    )

    expect(result.applied).toHaveLength(1)
  })
})

describe("currency filter", () => {
  it("percentage offers are currency-agnostic", async () => {
    const offer = makeOffer({ discountType: "percentage", discountPercent: "20" })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ baseCurrency: "EUR" }),
    )
    expect(result.applied).toHaveLength(1)
  })

  it("fixed_amount auto offers are silently dropped on currency mismatch", async () => {
    const offer = makeOffer({
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 500,
      currency: "USD",
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ baseCurrency: "EUR" }),
    )
    expect(result.applied).toEqual([])
    expect(result.codeStatus).toBeNull()
  })

  it("fixed_amount auto offers apply on currency match", async () => {
    const offer = makeOffer({
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 500,
      currency: "USD",
    })
    const result = await evaluateOffersForProduct(makeSource({ auto: [offer] }), baseCtx())
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.discountAppliedCents).toBe(500)
  })
})

describe("code validation — every CodeStatus", () => {
  const evalDate = new Date("2026-05-09T12:00:00Z")

  it("returns code_not_found when the code matches no active offer", async () => {
    const result = await evaluateOffersForProduct(
      makeSource(),
      baseCtx({ code: "DOESNOTEXIST", date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_found" })
    expect(result.applied).toEqual([])
  })

  it("returns code_expired when validUntil is past", async () => {
    const offer = makeOffer({
      code: "expired",
      validUntil: new Date("2026-05-01T00:00:00Z"),
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "EXPIRED", date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_expired" })
  })

  it("returns code_not_yet_valid when validFrom is in the future", async () => {
    const offer = makeOffer({
      code: "future",
      validFrom: new Date("2026-06-01T00:00:00Z"),
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "FUTURE", date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_yet_valid" })
  })

  it("returns code_not_applicable with reason='scope' when scope excludes", async () => {
    const offer = makeOffer({
      code: "partneronly",
      scope: { kind: "audiences", audiences: ["partner"] },
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({
        code: "PARTNERONLY",
        slice: { audience: "customer", market: "mkt_uk" },
        date: evalDate,
      }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_applicable", reason: "scope" })
    expect(result.applied).toEqual([])
  })

  it("returns code_not_applicable with reason='min_pax' when pax below threshold", async () => {
    const offer = makeOffer({ code: "groups4", conditions: { minPax: 4 } })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "GROUPS4", pax: 2, date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_applicable", reason: "min_pax" })
  })

  it("returns code_not_applicable with reason='eligibility' when eligibility excludes", async () => {
    const offer = makeOffer({ code: "family", conditions: { familyOnly: true } })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "FAMILY", eligibility: { family: false }, date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_applicable", reason: "eligibility" })
  })

  it("returns code_not_applicable with reason='currency' when fixed_amount currency mismatch", async () => {
    const offer = makeOffer({
      code: "fivebucks",
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 500,
      currency: "USD",
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "FIVEBUCKS", baseCurrency: "EUR", date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_applicable", reason: "currency" })
  })

  it("returns code_valid when all checks pass + applies the offer + preserves typed casing", async () => {
    const offer = makeOffer({
      code: "earlybird",
      discountPercent: "15",
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "EarlyBird", date: evalDate }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_valid" })
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.appliedCode).toBe("EarlyBird")
    expect(result.applied[0]?.discountAppliedCents).toBe(1_500) // 15% of 10_000
  })

  it("expired beats not_found when the code matches a real (expired) offer", async () => {
    // Confirms classification ordering: "found but expired" is more useful
    // feedback to the customer than "not found".
    const offer = makeOffer({
      code: "old",
      validUntil: new Date("2026-01-01T00:00:00Z"),
    })
    const result = await evaluateOffersForProduct(
      makeSource({ coded: [offer] }),
      baseCtx({ code: "OLD", date: evalDate }),
    )
    expect(result.codeStatus?.kind).toBe("code_expired")
  })
})

describe("code-gated + auto offers compose at checkout", () => {
  it("auto offers continue to apply when a code is supplied (and the code is valid)", async () => {
    const auto = makeOffer({ id: "pofr_auto", discountPercent: "10", stackable: true })
    const coded = makeOffer({
      id: "pofr_code",
      code: "extra5",
      discountPercent: "5",
      stackable: true,
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [auto], coded: [coded] }),
      baseCtx({ code: "EXTRA5" }),
    )
    expect(result.applied).toHaveLength(2)
    // 10% × 5% sequential = base * (1 - 0.9 * 0.95) = 14.5%
    expect(result.total.discountAppliedCents).toBe(1_450)
  })

  it("auto offers still apply when the code is not_found (caller decides whether to surface)", async () => {
    // The evaluator reports facts; the QUOTE caller (PR4) short-circuits to
    // an invalid quote on a bad code. The evaluator itself doesn't suppress
    // the auto offers — they're independent.
    const auto = makeOffer({ discountPercent: "10" })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [auto] }),
      baseCtx({ code: "WRONG" }),
    )
    expect(result.codeStatus).toEqual({ kind: "code_not_found" })
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.discountAppliedCents).toBe(1_000)
  })
})

describe("stacking — single non-stackable", () => {
  it("picks the largest cents off when multiple non-stackable offers compete", async () => {
    const small = makeOffer({ id: "pofr_small", discountPercent: "5" })
    const big = makeOffer({ id: "pofr_big", discountPercent: "20" })
    const result = await evaluateOffersForProduct(makeSource({ auto: [small, big] }), baseCtx())
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.offerId).toBe("pofr_big")
    expect(result.total.discountAppliedCents).toBe(2_000)
  })
})

describe("stacking — pure stackable composition (multiplicative)", () => {
  it("composes two stackable percentages multiplicatively (10% × 10% = 19%)", async () => {
    const a = makeOffer({ id: "pofr_a", discountPercent: "10", stackable: true })
    const b = makeOffer({ id: "pofr_b", discountPercent: "10", stackable: true })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [a, b] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.applied).toHaveLength(2)
    expect(result.total.discountAppliedCents).toBe(1_900) // 100 - 90 - 9 = 81 → 19 off
  })

  it("attributes per-offer discountAppliedCents using sequential application", async () => {
    const a = makeOffer({ id: "pofr_a", discountPercent: "10", stackable: true })
    const b = makeOffer({ id: "pofr_b", discountPercent: "10", stackable: true })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [a, b] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    // Sorted by id ascending → pofr_a first (1000 off 10000), then pofr_b (900 off 9000).
    expect(result.applied[0]?.offerId).toBe("pofr_a")
    expect(result.applied[0]?.discountAppliedCents).toBe(1_000)
    expect(result.applied[1]?.offerId).toBe("pofr_b")
    expect(result.applied[1]?.discountAppliedCents).toBe(900)
  })

  it("supports stackable fixed_amount offers (additive against running base)", async () => {
    const a = makeOffer({
      id: "pofr_a",
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 500,
      currency: "USD",
      stackable: true,
    })
    const b = makeOffer({
      id: "pofr_b",
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 300,
      currency: "USD",
      stackable: true,
    })
    const result = await evaluateOffersForProduct(makeSource({ auto: [a, b] }), baseCtx())
    expect(result.total.discountAppliedCents).toBe(800)
  })
})

describe("stacking — mixed pick (worked example from §10)", () => {
  it("Spring Sale 20% (non-stackable) beats Partner 10% × Loyalty 5% = 14.5% combined", async () => {
    const springSale = makeOffer({
      id: "pofr_spring",
      name: "Spring Sale",
      discountPercent: "20",
      stackable: false,
    })
    const partner = makeOffer({
      id: "pofr_partner",
      name: "Partner Discount",
      discountPercent: "10",
      stackable: true,
    })
    const loyalty = makeOffer({
      id: "pofr_loyalty",
      name: "Loyalty Bonus",
      discountPercent: "5",
      stackable: true,
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [springSale, partner, loyalty] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.offerName).toBe("Spring Sale")
    expect(result.total.discountAppliedCents).toBe(2_000)
  })

  it("with Spring Sale removed, Partner + Loyalty stack to 14.5%", async () => {
    const partner = makeOffer({
      id: "pofr_partner",
      discountPercent: "10",
      stackable: true,
    })
    const loyalty = makeOffer({
      id: "pofr_loyalty",
      discountPercent: "5",
      stackable: true,
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [partner, loyalty] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.applied).toHaveLength(2)
    // partner(10% of 10000) = 1000; loyalty(5% of 9000) = 450 → 1450 total
    expect(result.total.discountAppliedCents).toBe(1_450)
  })
})

describe("stacking — best path tie-breaker", () => {
  it("prefers the single non-stackable when discounts tie (simpler customer-facing receipt)", async () => {
    const single = makeOffer({
      id: "pofr_single",
      discountPercent: "10",
      stackable: false,
    })
    const stackA = makeOffer({
      id: "pofr_stack_a",
      discountPercent: "10",
      stackable: true,
    })
    // basePriceCents = 10_000:
    //   single → 1000 off
    //   stackable composed → 1000 off (10% of 10000)
    //   tie → prefer single
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [single, stackA] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.offerId).toBe("pofr_single")
  })
})

describe("edge cases", () => {
  it("caps fixed_amount discount at basePriceCents (never negative)", async () => {
    const huge = makeOffer({
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 50_000,
      currency: "USD",
    })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [huge] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.total.discountAppliedCents).toBe(10_000)
    expect(result.total.discountedPriceCents).toBe(0)
  })

  it("rounds percentage discount to whole cents (banker's-irrelevant — Math.round)", async () => {
    const offer = makeOffer({ discountPercent: "33.33" })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ basePriceCents: 1_000 }),
    )
    // 1000 * 33.33 / 100 = 333.3 → round → 333
    expect(result.total.discountAppliedCents).toBe(333)
  })

  it("`best` always references one row in `applied`", async () => {
    const a = makeOffer({ id: "pofr_a", discountPercent: "5", stackable: true })
    const b = makeOffer({ id: "pofr_b", discountPercent: "10", stackable: true })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [a, b] }),
      baseCtx({ basePriceCents: 10_000 }),
    )
    expect(result.best).not.toBeNull()
    expect(result.applied.some((row) => row.offerId === result.best?.offerId)).toBe(true)
  })

  it("`best` is null when applied is empty", async () => {
    const result = await evaluateOffersForProduct(makeSource(), baseCtx())
    expect(result.best).toBeNull()
  })

  it("propagates ctx.baseCurrency onto each AppliedOffer row", async () => {
    const offer = makeOffer({ discountPercent: "10" })
    const result = await evaluateOffersForProduct(
      makeSource({ auto: [offer] }),
      baseCtx({ baseCurrency: "EUR" }),
    )
    expect(result.applied[0]?.currency).toBe("EUR")
  })
})
