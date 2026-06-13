import { describe, expect, it } from "vitest"

import { evaluateOffersForProduct } from "../../src/service-evaluator.js"
import { baseCtx, makeOffer, makeSource } from "./evaluator-test-helpers.js"

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
