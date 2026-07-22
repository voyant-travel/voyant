import { describe, expect, it } from "vitest"

import { listProductsReferencingAccommodationProperty } from "../../src/service-presentation-references.js"

function referenceDb(propertyRows: unknown[], productRows: unknown[]) {
  let call = 0
  return {
    select() {
      const rows = call++ === 0 ? propertyRows : productRows
      return {
        from() {
          return {
            where() {
              return call === 1 ? { limit: async () => rows } : Promise.resolve(rows)
            },
          }
        },
      }
    },
  }
}

describe("listProductsReferencingAccommodationProperty", () => {
  it("fans out an owned property through its facility reference", async () => {
    const result = await listProductsReferencingAccommodationProperty(
      referenceDb([{ facilityId: "fac_1" }], [{ id: "prod_1" }, { id: "prod_1" }]) as never,
      "prop_1",
    )

    expect(result).toEqual([{ entityModule: "products", entityId: "prod_1" }])
  })

  it("fans out a provider property through its stable subject id", async () => {
    const result = await listProductsReferencingAccommodationProperty(
      referenceDb([], [{ id: "prod_provider" }]) as never,
      "properties_provider1",
    )

    expect(result).toEqual([{ entityModule: "products", entityId: "prod_provider" }])
  })
})
