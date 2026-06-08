import { describe, expect, it } from "vitest"

import {
  insertPipelineSchema,
  insertQuoteSchema,
  insertQuoteVersionSchema,
  insertStageSchema,
} from "../../src/validation.js"

describe("Pipeline schemas", () => {
  it("applies defaults", () => {
    const result = insertPipelineSchema.parse({ name: "Sales" })
    expect(result.entityType).toBe("quote")
    expect(result.isDefault).toBe(false)
    expect(result.sortOrder).toBe(0)
  })

  it("rejects empty name", () => {
    expect(() => insertPipelineSchema.parse({ name: "" })).toThrow()
  })
})

describe("Stage schemas", () => {
  it("requires pipelineId", () => {
    const result = insertStageSchema.parse({
      pipelineId: "crm_pip_abc",
      name: "Prospecting",
    })
    expect(result.pipelineId).toBe("crm_pip_abc")
  })

  it("rejects missing pipelineId", () => {
    expect(() => insertStageSchema.parse({ name: "Prospecting" })).toThrow()
  })

  it("accepts probability in range 0-100", () => {
    const result = insertStageSchema.parse({
      pipelineId: "crm_pip_abc",
      name: "Closing",
      probability: 75,
    })
    expect(result.probability).toBe(75)
  })

  it("rejects probability over 100", () => {
    expect(() =>
      insertStageSchema.parse({
        pipelineId: "crm_pip_abc",
        name: "Closing",
        probability: 150,
      }),
    ).toThrow()
  })

  it("rejects negative probability", () => {
    expect(() =>
      insertStageSchema.parse({
        pipelineId: "crm_pip_abc",
        name: "Closing",
        probability: -1,
      }),
    ).toThrow()
  })
})

describe("Quote schemas", () => {
  const validQuote = {
    title: "Big Deal",
    pipelineId: "crm_pip_abc",
    stageId: "crm_stg_abc",
  }

  it("requires title, pipelineId, stageId", () => {
    const result = insertQuoteSchema.parse(validQuote)
    expect(result.title).toBe("Big Deal")
    expect(result.status).toBe("open")
    expect(result.tags).toEqual([])
  })

  it("rejects missing title", () => {
    expect(() =>
      insertQuoteSchema.parse({
        pipelineId: "crm_pip_abc",
        stageId: "crm_stg_abc",
      }),
    ).toThrow()
  })

  it("accepts valid status enum", () => {
    const result = insertQuoteSchema.parse({ ...validQuote, status: "won" })
    expect(result.status).toBe("won")
  })

  it("rejects invalid status enum", () => {
    expect(() => insertQuoteSchema.parse({ ...validQuote, status: "invalid" })).toThrow()
  })
})

describe("Quote Version schemas", () => {
  it("requires quoteId and currency", () => {
    const result = insertQuoteVersionSchema.parse({
      quoteId: "crm_quot_abc",
      currency: "USD",
    })
    expect(result.quoteId).toBe("crm_quot_abc")
    expect(result.currency).toBe("USD")
    expect(result.subtotalAmountCents).toBe(0)
    expect(result.taxAmountCents).toBe(0)
    expect(result.totalAmountCents).toBe(0)
    expect(result.status).toBe("draft")
  })

  it("rejects missing currency", () => {
    expect(() => insertQuoteVersionSchema.parse({ quoteId: "crm_quot_abc" })).toThrow()
  })
})
