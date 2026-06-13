import { describe, expect, it } from "vitest"
import {
  createCruiseExtensionComponent,
  createCruiseExtensionLinkCommand,
  groupCruiseExtensionLinksByProduct,
  representCruiseExtensionSelection,
} from "../src/cruise-extension.js"

describe("cruise extension helpers", () => {
  it("links one reusable extension product to multiple cruises or sailings", () => {
    const links = [
      {
        extensionProductId: "prod_reykjavik_3n",
        targetKind: "cruise" as const,
        targetId: "cruise_arctic",
      },
      {
        extensionProductId: "prod_reykjavik_3n",
        targetKind: "cruise_sailing" as const,
        targetId: "sail_arctic_2026_06_01",
      },
    ]

    expect(links.map(createCruiseExtensionLinkCommand)).toEqual([
      {
        linkKey: "cruiseProductExtensionLink",
        leftId: "cruise_arctic",
        rightId: "prod_reykjavik_3n",
      },
      {
        linkKey: "cruiseSailingProductExtensionLink",
        leftId: "sail_arctic_2026_06_01",
        rightId: "prod_reykjavik_3n",
      },
    ])
    expect(groupCruiseExtensionLinksByProduct(links).get("prod_reykjavik_3n")).toHaveLength(2)
  })

  it("represents dependent cruise extensions as nested Extras", () => {
    expect(
      representCruiseExtensionSelection("trip_123", {
        extensionProductId: "prod_pre_hotel",
        targetKind: "cruise_sailing",
        targetId: "sail_123",
        placement: "pre",
        lifecycle: "dependent_extra",
        quantity: 2,
      }),
    ).toEqual({
      mode: "nested_extra",
      extra: {
        kind: "cruise_extension",
        productId: "prod_pre_hotel",
        targetKind: "cruise_sailing",
        targetId: "sail_123",
        placement: "pre",
        quantity: 2,
        metadata: {},
      },
    })
  })

  it("represents independently cancellable cruise extensions as sibling components", () => {
    expect(
      createCruiseExtensionComponent(
        "trip_123",
        {
          extensionProductId: "prod_post_bucharest",
          targetKind: "cruise",
          targetId: "cruise_bucharest_istanbul",
          placement: "post",
          lifecycle: "independent_component",
          metadata: { nights: 3 },
        },
        2,
      ),
    ).toEqual({
      envelopeId: "trip_123",
      sequence: 2,
      kind: "catalog_booking",
      catalogRef: {
        entityModule: "products",
        entityId: "prod_post_bucharest",
        sourceKind: "owned",
      },
      metadata: {
        kind: "cruise_extension",
        targetKind: "cruise",
        targetId: "cruise_bucharest_istanbul",
        placement: "post",
        lifecycle: "independent_component",
        quantity: 1,
        nights: 3,
      },
    })
  })
})
