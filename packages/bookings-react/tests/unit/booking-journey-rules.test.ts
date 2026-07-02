import { describe, expect, it } from "vitest"

import {
  buildCommitParty,
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

  it("does not commit a stale organization id for an individual buyer", () => {
    const draft = patchBilling(emptyDraft(ENTITY, { buyerType: "B2C" }), {
      organizationId: "org_stale",
      contact: {
        firstName: "Test",
        lastName: "Traveler",
        email: "test@example.com",
        personId: "person_1",
      },
    })

    expect(buildCommitParty(draft)).toMatchObject({
      personId: "person_1",
      organizationId: undefined,
      billing: {
        personId: "person_1",
        organizationId: undefined,
      },
    })
  })

  it("blocks payment advancement when an already-paid row has no payment date", () => {
    const shape = defaultMinimalShape()
    const draft = {
      ...emptyDraft(ENTITY),
      paymentSchedules: [
        {
          scheduleType: "balance",
          status: "paid",
          dueDate: "2026-06-15",
          currency: "EUR",
          amountCents: 50_000,
          notes: JSON.stringify({
            alreadyPaid: true,
            paymentDate: null,
            paymentMethod: "bank_transfer",
            paymentReference: null,
          }),
        } as const,
      ],
    }

    expect(canAdvanceFromStep("payment", draft, shape, true)).toBe(false)
  })

  it("blocks payment advancement when an already-paid row has a non-string payment date", () => {
    const shape = defaultMinimalShape()
    const draft = {
      ...emptyDraft(ENTITY),
      paymentSchedules: [
        {
          scheduleType: "balance",
          status: "paid",
          dueDate: "2026-06-15",
          currency: "EUR",
          amountCents: 50_000,
          notes: JSON.stringify({
            alreadyPaid: true,
            paymentDate: 123,
            paymentMethod: "bank_transfer",
            paymentReference: null,
          }),
        } as const,
      ],
    }

    expect(canAdvanceFromStep("payment", draft, shape, true)).toBe(false)
  })

  it("allows payment advancement when already-paid rows include payment dates", () => {
    const shape = defaultMinimalShape()
    const draft = {
      ...emptyDraft(ENTITY),
      paymentSchedules: [
        {
          scheduleType: "balance",
          status: "paid",
          dueDate: "2026-06-15",
          currency: "EUR",
          amountCents: 50_000,
          notes: JSON.stringify({
            alreadyPaid: true,
            paymentDate: "2026-06-10",
            paymentMethod: "bank_transfer",
            paymentReference: null,
          }),
        } as const,
      ],
    }

    expect(canAdvanceFromStep("payment", draft, shape, true)).toBe(true)
  })
})
