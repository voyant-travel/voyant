import { describe, expect, it } from "vitest"

import {
  contractNumberSeriesListQuerySchema,
  contractTemplateListQuerySchema,
  insertContractSchema,
  updateContractSchema,
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

  it("treats empty optional contract fields as omitted on create input", () => {
    expect(
      insertContractSchema.parse({
        scope: "customer",
        title: "Imported contract",
        contractNumber: "M 162",
        bookingId: "book_123",
        personId: "",
        organizationId: "",
        supplierId: "",
        seriesId: "",
        expiresAt: "",
        language: "ro",
      }),
    ).toMatchObject({
      bookingId: "book_123",
      personId: undefined,
      organizationId: undefined,
      supplierId: undefined,
      seriesId: undefined,
      expiresAt: undefined,
    })
  })

  it("treats empty optional contract fields as omitted on update input", () => {
    expect(
      updateContractSchema.parse({
        templateVersionId: "",
        personId: "",
        organizationId: "",
        supplierId: "",
        channelId: "",
        bookingId: "",
        orderId: "",
        expiresAt: "",
      }),
    ).toEqual({
      templateVersionId: undefined,
      personId: undefined,
      organizationId: undefined,
      supplierId: undefined,
      channelId: undefined,
      bookingId: undefined,
      orderId: undefined,
      expiresAt: undefined,
    })
  })
})
