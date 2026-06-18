import { describe, expect, it } from "vitest"

import {
  canAdvanceFromStep,
  defaultMinimalShape,
} from "../../src/journey/components/booking-journey-rules.js"
import { emptyDraft, patchBilling, patchConfigure } from "../../src/journey/lib/draft-state.js"

const ENTITY = {
  module: "products",
  id: "prod_1",
  sourceKind: "owned",
} as const

describe("booking-journey-rules", () => {
  it("allows a B2C billing contact with phone but no email to unlock the next step", () => {
    const shape = defaultMinimalShape()
    const draft = patchConfigure(
      patchBilling(emptyDraft(ENTITY, { buyerType: "B2C" }), {
        contact: {
          firstName: "Test",
          lastName: "Traveler",
          email: "",
          phone: "+15550100000",
          personId: "person_1",
        },
      }),
      { departureSlotId: "slot_1" },
    )

    expect(canAdvanceFromStep("billing", draft, shape, true)).toBe(true)
  })

  it("keeps B2C billing incomplete when neither email nor phone is present", () => {
    const shape = defaultMinimalShape()
    const draft = patchBilling(emptyDraft(ENTITY, { buyerType: "B2C" }), {
      contact: {
        firstName: "Test",
        lastName: "Traveler",
        email: "",
        personId: "person_1",
      },
    })

    expect(canAdvanceFromStep("billing", draft, shape, true)).toBe(false)
  })
})
