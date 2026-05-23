import { describe, expect, it } from "vitest"

import {
  contractNumberSeriesListQuerySchema,
  contractTemplateListQuerySchema,
  insertContractSchema,
} from "../../src/contracts/validation.js"

describe("legal contract validation", () => {
  it("parses boolean query parameters without treating false as truthy", () => {
    expect(contractNumberSeriesListQuerySchema.parse({ active: "true" })).toEqual({
      active: true,
    })
    expect(contractNumberSeriesListQuerySchema.parse({ active: "false" })).toEqual({
      active: false,
    })
    expect(contractTemplateListQuerySchema.parse({ active: "false" })).toMatchObject({
      active: false,
    })
  })

  it("accepts a manual contract number on contract create input", () => {
    expect(
      insertContractSchema.parse({
        scope: "customer",
        title: "Imported contract",
        contractNumber: " A-169 ",
      }),
    ).toMatchObject({
      contractNumber: "A-169",
    })
  })
})
