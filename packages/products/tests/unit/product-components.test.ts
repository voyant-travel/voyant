import { describe, expect, it } from "vitest"

import {
  productComponentRowToBookingChoiceGroup,
  productComponentRowToTravelComponent,
} from "../../src/product-components.js"

describe("productComponentRowToTravelComponent", () => {
  it("projects persisted rows to the shared travel component contract", () => {
    const component = productComponentRowToTravelComponent({
      id: "pcmp_test",
      productId: "prod_test",
      componentKind: "accommodation",
      title: "Hotel stay",
      summary: null,
      description: null,
      selection: "fixed",
      commitmentBoundary: "internal",
      priceDisposition: "included",
      required: true,
      quantity: 1,
      sortOrder: 10,
      binding: {
        type: "inline",
        content: {
          property: { name: "Sample Hotel" },
          room_type: { name: "Double room", max_occupancy: 2 },
          nights: 4,
        },
      },
      choices: [],
      media: [],
      tags: ["package"],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

    expect(component).toMatchObject({
      id: "pcmp_test",
      component_kind: "accommodation",
      title: "Hotel stay",
      sort_order: 10,
      tags: ["package"],
      binding: {
        type: "inline",
        content: {
          property: { name: "Sample Hotel" },
          nights: 4,
        },
      },
    })
  })

  it("projects selectable component rows to booking choice descriptors", () => {
    const group = productComponentRowToBookingChoiceGroup({
      id: "pcmp_room",
      productId: "prod_test",
      componentKind: "accommodation",
      title: "Room choice",
      summary: null,
      description: "Pick your room",
      selection: "choose_one",
      commitmentBoundary: "internal",
      priceDisposition: "included",
      required: true,
      quantity: null,
      sortOrder: 0,
      binding: {
        type: "inline",
        content: { property: { name: "Sample Hotel" } },
      },
      choices: [
        {
          id: "double",
          title: "Double room",
          pricing_ref: {
            option_id: "popt_room",
            option_unit_id: "ount_double",
            pricing_category_id: "prcat_double",
          },
          is_default: true,
        },
      ],
      media: [],
      tags: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

    expect(group).toEqual({
      componentId: "pcmp_room",
      componentKind: "accommodation",
      title: "Room choice",
      description: "Pick your room",
      selection: "choose_one",
      commitmentBoundary: "internal",
      priceDisposition: "included",
      required: true,
      quantity: null,
      sortOrder: 0,
      choices: [
        {
          id: "double",
          title: "Double room",
          description: null,
          isDefault: true,
          sortOrder: undefined,
          pricingRef: {
            optionId: "popt_room",
            optionUnitId: "ount_double",
            pricingCategoryId: "prcat_double",
            priceCatalogId: undefined,
            priceScheduleId: undefined,
          },
        },
      ],
    })
  })
})
