import { describe, expect, it } from "vitest"

import { productListQuerySchema } from "../../src/validation-core.js"

describe("productListQuerySchema", () => {
  it("accepts the new productTypeId / categoryId / tag filters", () => {
    const result = productListQuerySchema.parse({
      productTypeId: "ptyp_train",
      categoryId: "pcat_alpine",
      tag: "luxury",
    })

    expect(result.productTypeId).toBe("ptyp_train")
    expect(result.categoryId).toBe("pcat_alpine")
    expect(result.tag).toBe("luxury")
  })

  it("leaves the new filters undefined when not provided", () => {
    const result = productListQuerySchema.parse({})

    expect(result.productTypeId).toBeUndefined()
    expect(result.categoryId).toBeUndefined()
    expect(result.tag).toBeUndefined()
  })

  it("retains existing filters alongside the new ones", () => {
    const result = productListQuerySchema.parse({
      status: "active",
      productTypeId: "ptyp_train",
      tag: "luxury",
      limit: 10,
    })

    expect(result.status).toBe("active")
    expect(result.productTypeId).toBe("ptyp_train")
    expect(result.tag).toBe("luxury")
    expect(result.limit).toBe(10)
  })
})
