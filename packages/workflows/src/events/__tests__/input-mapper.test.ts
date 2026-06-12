import { describe, expect, test } from "vitest"

import { type InputMapper, projectInput, validateInputMapper } from "../input-mapper.js"
import type { PredicateEnvelope } from "../predicate.js"

const ENV: PredicateEnvelope = {
  name: "promotion.changed",
  data: {
    affected: { kind: "all", productIds: ["p1", "p2"] },
    offerId: "pofr_01",
    discountPct: 20,
  },
  metadata: {
    tenantId: "default",
    eventId: "evt_01",
  },
  emittedAt: "2026-05-09T13:22:08.000Z",
}

function malformedInputMapper(value: unknown): InputMapper {
  return value as InputMapper
}

function malformedLiteral(value: unknown): null {
  return value as null
}

// ---- projectInput ----

describe("projectInput — pass-through variants", () => {
  test("undefined → envelope.data", () => {
    expect(projectInput(undefined, ENV)).toEqual(ENV.data)
  })

  test("{ passthrough: true } → envelope.data", () => {
    expect(projectInput({ passthrough: true }, ENV)).toEqual(ENV.data)
  })
})

describe("projectInput — { path }", () => {
  test("scalar path", () => {
    expect(projectInput({ path: "data.offerId" }, ENV)).toBe("pofr_01")
  })

  test("nested path", () => {
    expect(projectInput({ path: "data.affected.kind" }, ENV)).toBe("all")
  })

  test("array index", () => {
    expect(projectInput({ path: "data.affected.productIds[0]" }, ENV)).toBe("p1")
  })

  test("metadata path", () => {
    expect(projectInput({ path: "metadata.eventId" }, ENV)).toBe("evt_01")
  })

  test("name root", () => {
    expect(projectInput({ path: "name" }, ENV)).toBe("promotion.changed")
  })

  test("missing path → undefined (not throw)", () => {
    expect(projectInput({ path: "data.missing" }, ENV)).toBeUndefined()
  })

  test("empty string path throws structurally", () => {
    expect(() => projectInput({ path: "" }, ENV)).toThrow()
  })
})

describe("projectInput — { object }", () => {
  test("flat object with mixed paths + literals", () => {
    const out = projectInput(
      {
        object: {
          sellerOperatorId: { path: "metadata.tenantId" },
          source: { path: "data.affected.kind" },
          marker: { lit: "promotion.changed" },
          count: { lit: 42 },
          isAll: { lit: true },
        },
      },
      ENV,
    )
    expect(out).toEqual({
      sellerOperatorId: "default",
      source: "all",
      marker: "promotion.changed",
      count: 42,
      isAll: true,
    })
  })

  test("nested object via inline mapper", () => {
    const out = projectInput(
      {
        object: {
          sellerOperatorId: { path: "metadata.tenantId" },
          reason: {
            object: {
              kind: { lit: "promotion.changed" },
              offerId: { path: "data.offerId" },
            },
          },
        },
      },
      ENV,
    )
    expect(out).toEqual({
      sellerOperatorId: "default",
      reason: { kind: "promotion.changed", offerId: "pofr_01" },
    })
  })

  test("missing path inside object → undefined leaf", () => {
    const out = projectInput({ object: { foo: { path: "data.missing" } } }, ENV) as Record<
      string,
      unknown
    >
    expect(out.foo).toBeUndefined()
  })

  test("nested passthrough yields envelope.data inside object", () => {
    const out = projectInput({ object: { wrapped: { passthrough: true } } }, ENV) as Record<
      string,
      unknown
    >
    expect(out.wrapped).toEqual(ENV.data)
  })

  test("empty object yields {}", () => {
    expect(projectInput({ object: {} }, ENV)).toEqual({})
  })

  test("nullish lit handled correctly", () => {
    const out = projectInput(
      {
        object: {
          n: { lit: null },
          s: { lit: "x" },
          z: { lit: 0 },
        },
      },
      ENV,
    )
    expect(out).toEqual({ n: null, s: "x", z: 0 })
  })
})

describe("projectInput — structural errors throw", () => {
  test("non-object mapper throws", () => {
    expect(() => projectInput(malformedInputMapper("garbage"), ENV)).toThrow()
  })

  test("unknown mapper variant throws", () => {
    expect(() => projectInput(malformedInputMapper({ wat: "x" }), ENV)).toThrow()
  })

  test("{ passthrough: false } throws", () => {
    expect(() => projectInput(malformedInputMapper({ passthrough: false }), ENV)).toThrow()
  })
})

// ---- validateInputMapper ----

describe("validateInputMapper", () => {
  test("undefined mapper passes", () => {
    expect(validateInputMapper(undefined)).toEqual({ ok: true, errors: [] })
  })

  test("valid passthrough", () => {
    expect(validateInputMapper({ passthrough: true })).toEqual({ ok: true, errors: [] })
  })

  test("valid path", () => {
    expect(validateInputMapper({ path: "data.x" }).ok).toBe(true)
  })

  test("rejects unknown root in path", () => {
    const r = validateInputMapper({ path: "payload.x" })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/path root "payload"/)
  })

  test("rejects empty path", () => {
    expect(validateInputMapper({ path: "" }).ok).toBe(false)
  })

  test("validates nested object children", () => {
    const r = validateInputMapper({
      object: {
        valid: { path: "data.x" },
        bad: { path: "rogue.y" },
        nested: {
          object: {
            inner: { path: "alsoBad.z" },
          },
        },
      },
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('path root "rogue"'))).toBe(true)
    expect(r.errors.some((e) => e.includes('path root "alsoBad"'))).toBe(true)
  })

  test("rejects invalid lit type", () => {
    const r = validateInputMapper({
      object: { ts: { lit: malformedLiteral(new Date()) } },
    })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/lit.*string \| number \| boolean \| null/)
  })

  test("empty object value rejected", () => {
    const r = validateInputMapper({} as InputMapper)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/passthrough \| path \| object/)
  })
})
