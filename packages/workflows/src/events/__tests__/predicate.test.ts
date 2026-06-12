import { describe, expect, test } from "vitest"

import {
  evaluatePredicate,
  type PredicateEnvelope,
  type PredicateExpr,
  resolvePath,
  validatePredicate,
} from "../predicate.js"

const ENV: PredicateEnvelope = {
  name: "promotion.changed",
  data: {
    affected: { kind: "all", productIds: ["p1", "p2"] },
    offerId: "pofr_01",
    discountPct: 20,
    enabled: true,
  },
  metadata: {
    tenantId: "default",
    eventId: "evt_01",
  },
  emittedAt: "2026-05-09T13:22:08.000Z",
}

function malformedPredicate(value: unknown): PredicateExpr {
  return value as PredicateExpr
}

// ---- resolvePath ----

describe("resolvePath", () => {
  test.each([
    ["name", "promotion.changed"],
    ["emittedAt", "2026-05-09T13:22:08.000Z"],
    ["data.affected.kind", "all"],
    ["data.affected.productIds[0]", "p1"],
    ["data.affected.productIds[1]", "p2"],
    ["data.offerId", "pofr_01"],
    ["data.discountPct", 20],
    ["data.enabled", true],
    ["metadata.tenantId", "default"],
    ["metadata.eventId", "evt_01"],
  ])("%s -> %j", (path, expected) => {
    expect(resolvePath(path, ENV)).toEqual(expected)
  })

  test.each([
    "data.missing",
    "data.affected.missing",
    "data.affected.productIds[5]",
    "metadata.missing",
    "unknownRoot",
    "unknownRoot.x",
    "",
  ])("%s -> undefined", (path) => {
    expect(resolvePath(path, ENV)).toBeUndefined()
  })

  test("malformed bracket yields []", () => {
    expect(resolvePath("data.items[", ENV)).toBeUndefined()
  })
})

// ---- evaluatePredicate ----

describe("evaluatePredicate — eq / neq", () => {
  test("eq path-vs-lit", () => {
    expect(evaluatePredicate({ eq: [{ path: "data.affected.kind" }, { lit: "all" }] }, ENV)).toBe(
      true,
    )
  })

  test("eq mismatch", () => {
    expect(
      evaluatePredicate({ eq: [{ path: "data.affected.kind" }, { lit: "products" }] }, ENV),
    ).toBe(false)
  })

  test("eq path-vs-path", () => {
    expect(
      evaluatePredicate(
        { eq: [{ path: "metadata.tenantId" }, { path: "metadata.tenantId" }] },
        ENV,
      ),
    ).toBe(true)
  })

  test("eq with missing path always false", () => {
    expect(evaluatePredicate({ eq: [{ path: "data.missing" }, { lit: null }] }, ENV)).toBe(false)
  })

  test("eq number/string mismatch is false", () => {
    expect(evaluatePredicate({ eq: [{ path: "data.discountPct" }, { lit: "20" }] }, ENV)).toBe(
      false,
    )
  })

  test("eq null-vs-null is true", () => {
    expect(evaluatePredicate({ eq: [{ lit: null }, { lit: null }] }, ENV)).toBe(true)
  })

  test("neq inverts", () => {
    expect(evaluatePredicate({ neq: [{ path: "data.affected.kind" }, { lit: "all" }] }, ENV)).toBe(
      false,
    )
    expect(
      evaluatePredicate({ neq: [{ path: "data.affected.kind" }, { lit: "products" }] }, ENV),
    ).toBe(true)
  })
})

describe("evaluatePredicate — in", () => {
  test("membership match", () => {
    expect(
      evaluatePredicate(
        { in: [{ path: "data.affected.kind" }, [{ lit: "products" }, { lit: "all" }]] },
        ENV,
      ),
    ).toBe(true)
  })

  test("membership miss", () => {
    expect(
      evaluatePredicate(
        { in: [{ path: "data.affected.kind" }, [{ lit: "x" }, { lit: "y" }]] },
        ENV,
      ),
    ).toBe(false)
  })

  test("missing lhs path → false", () => {
    expect(evaluatePredicate({ in: [{ path: "data.missing" }, [{ lit: "all" }]] }, ENV)).toBe(false)
  })

  test("empty rhs → false", () => {
    expect(evaluatePredicate({ in: [{ path: "data.affected.kind" }, []] }, ENV)).toBe(false)
  })
})

describe("evaluatePredicate — gt / gte / lt / lte", () => {
  test("number gt true", () => {
    expect(evaluatePredicate({ gt: [{ path: "data.discountPct" }, { lit: 10 }] }, ENV)).toBe(true)
  })
  test("number gt false (eq)", () => {
    expect(evaluatePredicate({ gt: [{ path: "data.discountPct" }, { lit: 20 }] }, ENV)).toBe(false)
  })
  test("number gte at boundary", () => {
    expect(evaluatePredicate({ gte: [{ path: "data.discountPct" }, { lit: 20 }] }, ENV)).toBe(true)
  })
  test("number lt true", () => {
    expect(evaluatePredicate({ lt: [{ path: "data.discountPct" }, { lit: 30 }] }, ENV)).toBe(true)
  })
  test("number lte at boundary", () => {
    expect(evaluatePredicate({ lte: [{ path: "data.discountPct" }, { lit: 20 }] }, ENV)).toBe(true)
  })

  test("string lex compare", () => {
    expect(evaluatePredicate({ gt: [{ lit: "b" }, { lit: "a" }] }, ENV)).toBe(true)
    expect(evaluatePredicate({ lt: [{ lit: "a" }, { lit: "b" }] }, ENV)).toBe(true)
  })

  test("type mismatch returns false (not throw)", () => {
    expect(evaluatePredicate({ gt: [{ path: "data.discountPct" }, { lit: "10" }] }, ENV)).toBe(
      false,
    )
  })

  test("missing path returns false", () => {
    expect(evaluatePredicate({ gt: [{ path: "data.missing" }, { lit: 0 }] }, ENV)).toBe(false)
  })
})

describe("evaluatePredicate — exists / not / and / or", () => {
  test("exists true", () => {
    expect(evaluatePredicate({ exists: { path: "metadata.eventId" } }, ENV)).toBe(true)
  })
  test("exists false on missing", () => {
    expect(evaluatePredicate({ exists: { path: "metadata.missing" } }, ENV)).toBe(false)
  })

  test("not inverts", () => {
    expect(
      evaluatePredicate({ not: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] } }, ENV),
    ).toBe(false)
  })

  test("and short-circuits semantics", () => {
    expect(
      evaluatePredicate(
        {
          and: [
            { eq: [{ path: "name" }, { lit: "promotion.changed" }] },
            { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
          ],
        },
        ENV,
      ),
    ).toBe(true)
    expect(
      evaluatePredicate(
        {
          and: [
            { eq: [{ path: "name" }, { lit: "promotion.changed" }] },
            { eq: [{ path: "data.affected.kind" }, { lit: "products" }] },
          ],
        },
        ENV,
      ),
    ).toBe(false)
  })

  test("or matches any", () => {
    expect(
      evaluatePredicate(
        {
          or: [
            { eq: [{ path: "data.affected.kind" }, { lit: "x" }] },
            { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
          ],
        },
        ENV,
      ),
    ).toBe(true)
  })

  test("empty and is true (vacuously)", () => {
    expect(evaluatePredicate({ and: [] }, ENV)).toBe(true)
  })

  test("empty or is false (vacuously)", () => {
    expect(evaluatePredicate({ or: [] }, ENV)).toBe(false)
  })
})

// ---- validatePredicate ----

describe("validatePredicate", () => {
  test("valid predicate passes", () => {
    const result = validatePredicate({
      and: [
        { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
        { exists: { path: "metadata.eventId" } },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  test("rejects unknown root", () => {
    const result = validatePredicate({
      eq: [{ path: "payload.something" }, { lit: "x" }],
    } as PredicateExpr)
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/path root "payload"/)
  })

  test("rejects unknown operator", () => {
    const result = validatePredicate(malformedPredicate({ wat: ["x"] }))
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/unknown predicate operator/)
  })

  test("rejects mixed-type ordered comparison literals", () => {
    const result = validatePredicate({
      gt: [{ lit: 10 }, { lit: "10" }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/ordered comparison sides must agree on type/)
  })

  test("rejects malformed object (multiple operator keys)", () => {
    const result = validatePredicate(
      malformedPredicate({
        eq: [{ lit: 1 }, { lit: 1 }],
        neq: [{ lit: 1 }, { lit: 2 }],
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/exactly one operator key/)
  })

  test("rejects empty path", () => {
    const result = validatePredicate({
      exists: { path: "" },
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/non-empty/)
  })

  test("rejects malformed side (neither path nor lit)", () => {
    const result = validatePredicate({
      eq: [{} as never, { lit: "x" }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/must specify "path" or "lit"/)
  })

  test("validates nested predicates", () => {
    const result = validatePredicate({
      and: [
        { eq: [{ path: "data.kind" }, { lit: "x" }] },
        { not: { eq: [{ path: "rogueRoot" }, { lit: "y" }] } as PredicateExpr },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('path root "rogueRoot"'))).toBe(true)
  })
})
