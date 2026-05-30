import { describe, expect, it } from "vitest"

import {
  insertPromotionalOfferSchema,
  promotionalOfferConditionsSchema,
  promotionalOfferListQuerySchema,
  promotionalOfferScopeSchema,
  updatePromotionalOfferSchema,
} from "../../src/validation.js"

describe("promotionalOfferScopeSchema", () => {
  it("accepts global scope", () => {
    expect(promotionalOfferScopeSchema.parse({ kind: "global" })).toEqual({ kind: "global" })
  })

  it("accepts products scope with non-empty productIds", () => {
    const scope = { kind: "products" as const, productIds: ["prod_a", "prod_b"] }
    expect(promotionalOfferScopeSchema.parse(scope)).toEqual(scope)
  })

  it("rejects products scope with empty productIds", () => {
    expect(() => promotionalOfferScopeSchema.parse({ kind: "products", productIds: [] })).toThrow()
  })

  it("accepts categories scope", () => {
    expect(
      promotionalOfferScopeSchema.parse({ kind: "categories", categoryIds: ["cat_a"] }),
    ).toEqual({ kind: "categories", categoryIds: ["cat_a"] })
  })

  it("accepts destinations scope", () => {
    expect(
      promotionalOfferScopeSchema.parse({ kind: "destinations", destinationIds: ["dest_a"] }),
    ).toEqual({ kind: "destinations", destinationIds: ["dest_a"] })
  })

  it("accepts markets scope", () => {
    expect(promotionalOfferScopeSchema.parse({ kind: "markets", marketIds: ["mkt_a"] })).toEqual({
      kind: "markets",
      marketIds: ["mkt_a"],
    })
  })

  it("accepts audiences scope with valid Visibility literals", () => {
    const scope = { kind: "audiences" as const, audiences: ["customer", "partner"] as const }
    expect(promotionalOfferScopeSchema.parse(scope)).toEqual(scope)
  })

  it("accepts fare-code scope", () => {
    const scope = { kind: "fare_codes" as const, fareCodes: ["EARLY_BIRD", "PAST_GUEST"] }
    expect(promotionalOfferScopeSchema.parse(scope)).toEqual(scope)
  })

  it("accepts cabin-grade scope", () => {
    const scope = { kind: "cabin_grades" as const, cabinGradeCodes: ["SUITE", "BALCONY"] }
    expect(promotionalOfferScopeSchema.parse(scope)).toEqual(scope)
  })

  it("rejects audiences scope with unknown audience literal", () => {
    expect(() =>
      promotionalOfferScopeSchema.parse({ kind: "audiences", audiences: ["nope"] }),
    ).toThrow()
  })

  it("rejects unknown scope kind (no `channels` in v1)", () => {
    expect(() =>
      promotionalOfferScopeSchema.parse({ kind: "channels", channelScopes: ["b2c"] }),
    ).toThrow()
  })
})

describe("promotionalOfferConditionsSchema", () => {
  it("accepts an empty conditions object", () => {
    expect(promotionalOfferConditionsSchema.parse({})).toEqual({})
  })

  it("accepts minPax as a positive integer", () => {
    expect(promotionalOfferConditionsSchema.parse({ minPax: 4 })).toEqual({ minPax: 4 })
  })

  it("accepts structured eligibility flags", () => {
    expect(
      promotionalOfferConditionsSchema.parse({
        pastGuestOnly: true,
        soloTravelerOnly: true,
        childTravelerOnly: true,
        familyOnly: true,
      }),
    ).toEqual({
      pastGuestOnly: true,
      soloTravelerOnly: true,
      childTravelerOnly: true,
      familyOnly: true,
    })
  })

  it("rejects minPax = 0", () => {
    expect(() => promotionalOfferConditionsSchema.parse({ minPax: 0 })).toThrow()
  })

  it("rejects fractional minPax", () => {
    expect(() => promotionalOfferConditionsSchema.parse({ minPax: 2.5 })).toThrow()
  })
})

describe("insertPromotionalOfferSchema — discount type / currency rules", () => {
  const baseValid = {
    name: "Spring Sale",
    slug: "spring-sale",
    scope: { kind: "global" as const },
  }

  it("accepts a percentage offer with discountPercent only", () => {
    const parsed = insertPromotionalOfferSchema.parse({
      ...baseValid,
      discountType: "percentage",
      discountPercent: 20,
    })
    expect(parsed.discountPercent).toBe(20)
    expect(parsed.currency).toBeUndefined()
  })

  it("rejects a percentage offer that also sets discountAmountCents", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "percentage",
        discountPercent: 20,
        discountAmountCents: 500,
      }),
    ).toThrow(/percentage offers/i)
  })

  it("rejects a percentage offer that sets currency", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "percentage",
        discountPercent: 20,
        currency: "USD",
      }),
    ).toThrow(/percentage offers/i)
  })

  it("rejects a percentage offer missing discountPercent", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "percentage",
      }),
    ).toThrow(/percentage offers/i)
  })

  it("accepts a fixed_amount offer with amount + currency", () => {
    const parsed = insertPromotionalOfferSchema.parse({
      ...baseValid,
      discountType: "fixed_amount",
      discountAmountCents: 500,
      currency: "USD",
    })
    expect(parsed.discountAmountCents).toBe(500)
    expect(parsed.currency).toBe("USD")
  })

  it("rejects a fixed_amount offer without currency", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "fixed_amount",
        discountAmountCents: 500,
      }),
    ).toThrow(/fixed_amount offers/i)
  })

  it("rejects a fixed_amount offer without discountAmountCents", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "fixed_amount",
        currency: "USD",
      }),
    ).toThrow(/fixed_amount offers/i)
  })

  it("rejects a fixed_amount offer that also sets discountPercent", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...baseValid,
        discountType: "fixed_amount",
        discountAmountCents: 500,
        currency: "USD",
        discountPercent: 20,
      }),
    ).toThrow(/fixed_amount offers/i)
  })
})

describe("insertPromotionalOfferSchema — validity window", () => {
  it("rejects validFrom >= validUntil", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        name: "Bad",
        slug: "bad",
        scope: { kind: "global" },
        discountType: "percentage",
        discountPercent: 10,
        validFrom: new Date("2026-06-01"),
        validUntil: new Date("2026-05-01"),
      }),
    ).toThrow(/validFrom/)
  })

  it("accepts a window where validFrom < validUntil", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        name: "OK",
        slug: "ok",
        scope: { kind: "global" },
        discountType: "percentage",
        discountPercent: 10,
        validFrom: new Date("2026-05-01"),
        validUntil: new Date("2026-06-01"),
      }),
    ).not.toThrow()
  })

  it("accepts open-ended validity (no validFrom or validUntil)", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        name: "Open",
        slug: "open",
        scope: { kind: "global" },
        discountType: "percentage",
        discountPercent: 10,
      }),
    ).not.toThrow()
  })
})

describe("insertPromotionalOfferSchema — slug + code formats", () => {
  const validBase = {
    name: "X",
    scope: { kind: "global" as const },
    discountType: "percentage" as const,
    discountPercent: 5,
  }

  it("accepts a kebab-case slug", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({ ...validBase, slug: "spring-sale-2026" }),
    ).not.toThrow()
  })

  it("rejects a slug with uppercase or spaces", () => {
    for (const bad of ["Spring Sale", "Spring-Sale", "spring sale"]) {
      expect(() => insertPromotionalOfferSchema.parse({ ...validBase, slug: bad })).toThrow(/slug/)
    }
  })

  it("accepts an alphanumeric code with - and _", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...validBase,
        slug: "ok",
        code: "EARLYBIRD-2026_X",
      }),
    ).not.toThrow()
  })

  it("rejects a code with spaces", () => {
    expect(() =>
      insertPromotionalOfferSchema.parse({
        ...validBase,
        slug: "ok",
        code: "EARLY BIRD",
      }),
    ).toThrow(/code/)
  })
})

describe("updatePromotionalOfferSchema", () => {
  it("allows omitting all fields (no-op patch)", () => {
    expect(() => updatePromotionalOfferSchema.parse({})).not.toThrow()
  })

  it("still enforces type/currency rule when discountType is supplied with mismatched fields", () => {
    expect(() =>
      updatePromotionalOfferSchema.parse({
        discountType: "percentage",
        discountAmountCents: 100,
      }),
    ).toThrow(/percentage offers/i)
  })
})

describe("promotionalOfferListQuerySchema", () => {
  it("accepts operator list filters", () => {
    expect(
      promotionalOfferListQuerySchema.parse({
        search: "spring",
        applicationMode: "code",
        status: "scheduled",
        scopeKind: "products",
        validFrom: "2026-05-01",
        validUntil: "2026-05-31",
        limit: "25",
        offset: "50",
      }),
    ).toEqual({
      search: "spring",
      applicationMode: "code",
      status: "scheduled",
      scopeKind: "products",
      validFrom: "2026-05-01",
      validUntil: "2026-05-31",
      limit: 25,
      offset: 50,
    })
  })
})
