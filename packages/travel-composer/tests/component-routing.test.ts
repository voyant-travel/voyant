import type { TravelComponent } from "@voyantjs/travel-components-contracts"
import { describe, expect, it } from "vitest"

import { projectIndependentCatalogComponents } from "../src/component-routing.js"

describe("projectIndependentCatalogComponents", () => {
  it("projects selected independent component choices to catalog booking components", () => {
    const components: TravelComponent[] = [
      {
        id: "pcmp_excursion",
        component_kind: "activity",
        title: "Optional excursion",
        selection: "optional",
        commitment_boundary: "independent_component",
        price_disposition: "add_on",
        required: false,
        tags: [],
        choices: [
          {
            id: "rafting",
            title: "Rafting",
            ref: {
              entity_module: "products",
              entity_id: "prod_rafting",
              source_kind: "owned",
            },
          },
        ],
        media: [],
        binding: {
          type: "inline",
          content: {
            title: "Optional excursion",
            inclusions: [],
            media: [],
          },
        },
      },
    ]

    const result = projectIndependentCatalogComponents({
      components,
      selections: [{ componentId: "pcmp_excursion", choiceId: "rafting", quantity: 2 }],
      baseBookingDraft: {
        configure: {
          departureSlotId: "slot_1",
          pax: { adult: 2 },
          componentSelections: [
            { componentId: "pcmp_excursion", choiceId: "rafting", quantity: 2 },
          ],
        },
        travelers: [
          {
            firstName: "Ana",
            lastName: "Ionescu",
            band: "adult",
          },
        ],
      },
      startSequence: 1,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: "catalog_booking",
      sequence: 1,
      catalogRef: {
        entityModule: "products",
        entityId: "prod_rafting",
        sourceKind: "owned",
      },
      metadata: {
        productComponent: {
          componentId: "pcmp_excursion",
          componentKind: "activity",
          choiceId: "rafting",
          commitmentBoundary: "independent_component",
          priceDisposition: "add_on",
          quantity: 2,
        },
      },
    })
    expect(result[0]?.metadata.bookingDraftV1.entity).toEqual({
      module: "products",
      id: "prod_rafting",
      sourceKind: "owned",
    })
    expect(result[0]?.metadata.bookingDraftV1.configure).toMatchObject({
      departureSlotId: "slot_1",
      pax: { adult: 2 },
    })
    expect(result[0]?.metadata.bookingDraftV1.configure.componentSelections).toBeUndefined()
  })

  it("projects fixed independent component refs and skips internal components", () => {
    const components: TravelComponent[] = [
      {
        id: "pcmp_transfer",
        component_kind: "transport",
        title: "Private transfer",
        selection: "fixed",
        commitment_boundary: "independent_component",
        price_disposition: "included",
        tags: [],
        choices: [],
        media: [],
        binding: {
          type: "ref",
          ref: {
            entity_module: "products",
            entity_id: "prod_transfer",
          },
        },
      },
      {
        id: "pcmp_hotel",
        component_kind: "accommodation",
        title: "Hotel",
        selection: "fixed",
        commitment_boundary: "internal",
        price_disposition: "included",
        tags: [],
        choices: [],
        media: [],
        binding: {
          type: "inline",
          content: {
            property: { name: "Hotel" },
          },
        },
      },
    ]

    const result = projectIndependentCatalogComponents({ components })

    expect(result).toHaveLength(1)
    expect(result[0]?.catalogRef).toEqual({
      entityModule: "products",
      entityId: "prod_transfer",
      sourceKind: "owned",
    })
  })
})
