import { describe, expect, it } from "vitest"

import {
  boardBasisSchema,
  type TravelComponent,
  travelComponentSchema,
  validateTravelComponent,
} from "./index.js"

describe("@voyantjs/travel-components-contracts content shape", () => {
  it("validates an inline accommodation component with board basis", () => {
    const component = travelComponentSchema.parse({
      id: "cmp_stay",
      component_kind: "accommodation",
      title: "Hotel stay",
      binding: {
        type: "inline",
        content: {
          property: { name: "Sample Hotel", star_rating: 4 },
          room_type: { name: "Standard Double", max_occupancy: 2 },
          rate_plan: { name: "Half board", board_basis: "half_board" },
          board_basis: "half_board",
          nights: 5,
        },
      },
    }) satisfies TravelComponent

    expect(validateTravelComponent(component)).toMatchObject({ valid: true })
    expect(component.selection).toBe("fixed")
    expect(component.commitment_boundary).toBe("internal")
    expect(component.price_disposition).toBe("included")
  })

  it("validates a transport component with multiple legs", () => {
    const component = travelComponentSchema.parse({
      id: "cmp_transport",
      component_kind: "transport",
      title: "Return coach",
      binding: {
        type: "inline",
        content: {
          legs: [
            {
              mode: "coach",
              from: { name: "Pickup point" },
              to: { name: "Hotel" },
              duration_minutes: 90,
            },
          ],
        },
      },
    }) satisfies TravelComponent

    expect(validateTravelComponent(component)).toMatchObject({ valid: true })
  })

  it("validates a referenced independent activity component", () => {
    const component = travelComponentSchema.parse({
      id: "cmp_excursion",
      component_kind: "activity",
      title: "Optional excursion",
      selection: "optional",
      commitment_boundary: "independent_component",
      price_disposition: "add_on",
      binding: {
        type: "ref",
        ref: {
          entity_module: "products",
          entity_id: "prod_excursion",
          source_kind: "owned",
        },
      },
    }) satisfies TravelComponent

    expect(validateTravelComponent(component)).toMatchObject({ valid: true })
  })

  it("validates component choices that reference existing pricing identifiers", () => {
    const component = travelComponentSchema.parse({
      id: "cmp_room",
      component_kind: "accommodation",
      title: "Room choice",
      selection: "choose_one",
      binding: {
        type: "inline",
        content: {
          property: { name: "Sample Hotel" },
        },
      },
      choices: [
        {
          id: "choice_double",
          title: "Double room",
          pricing_ref: {
            option_id: "popt_room",
            option_unit_id: "ount_double",
            pricing_category_id: "prcat_double",
          },
          is_default: true,
        },
      ],
    }) satisfies TravelComponent

    expect(validateTravelComponent(component)).toMatchObject({ valid: true })
    expect(component.choices[0]?.pricing_ref?.option_unit_id).toBe("ount_double")
  })

  it("rejects invalid board basis and unknown component kind", () => {
    expect(boardBasisSchema.safeParse("breakfast_only").success).toBe(false)
    expect(
      validateTravelComponent({ id: "cmp", component_kind: "room", title: "Room" }),
    ).toMatchObject({ valid: false })
  })
})
