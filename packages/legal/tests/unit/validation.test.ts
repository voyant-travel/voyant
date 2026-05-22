import { describe, expect, it } from "vitest"

import {
  contractNumberSeriesListQuerySchema,
  contractTemplateListQuerySchema,
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
})
