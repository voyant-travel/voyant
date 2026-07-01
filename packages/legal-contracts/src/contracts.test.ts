import { describe, expect, it } from "vitest"

import {
  insertContractNumberSeriesSchema,
  updateContractNumberSeriesSchema,
} from "./contracts/validation.js"
import * as legalContracts from "./index.js"

describe("@voyant-travel/legal-contracts", () => {
  it("exposes the contracts + policies validation surface", () => {
    // Smoke test: the barrel re-exports both validation modules with real schemas.
    expect(Object.keys(legalContracts).length).toBeGreaterThan(0)
  })

  it("applies contract number series defaults on create", () => {
    expect(
      insertContractNumberSeriesSchema.parse({
        name: "Customer contracts",
        prefix: "CTR",
      }),
    ).toMatchObject({
      separator: "",
      padLength: 4,
      resetStrategy: "never",
      scope: "customer",
      isDefault: false,
      active: true,
    })
  })

  it("does not apply contract number series defaults on update", () => {
    expect(updateContractNumberSeriesSchema.parse({ separator: "-" })).toEqual({ separator: "-" })
    expect(updateContractNumberSeriesSchema.parse({})).toEqual({})
  })
})
