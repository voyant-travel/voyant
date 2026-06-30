import type { TripComponent } from "@voyant-travel/trips"
import { describe, expect, it } from "vitest"
import {
  hydrateBilling,
  hydrateTravelers,
  hydrateVoucher,
  paymentScheduleReserveValidationReason,
  paymentScheduleToRows,
  tripTravelerRoleFromStored,
} from "../src/admin/admin-trips-page-model.js"
import {
  pendingComponentIsValid,
  pendingStayDateRangeIsValid,
} from "../src/admin/trips-panels/manual-configurators.js"

describe("admin trips page model", () => {
  it("hydrates persisted traveler party fields for composer state", () => {
    const travelerParty = {
      billing: {
        buyerType: "B2B",
        organizationId: "org_123",
        contact: { firstName: "Ana", lastName: "Pop", email: "ana@example.com" },
      },
      travelers: [
        { localId: "lead", firstName: "Ana", lastName: "Pop", email: "ana@example.com" },
        { personId: "per_2", firstName: "Mihai", role: "child" },
      ],
      voucher: {
        id: "vch_1",
        code: "SUMMER",
        currency: "EUR",
        remainingAmountCents: 2500,
      },
    }

    expect(hydrateBilling(travelerParty)).toMatchObject({
      mode: "existing",
      billTo: "organization",
      organizationId: "org_123",
    })
    expect(hydrateTravelers(travelerParty)).toEqual([
      {
        localId: "lead",
        personId: null,
        firstName: "Ana",
        lastName: "Pop",
        email: "ana@example.com",
        dateOfBirth: null,
        role: "lead",
      },
      {
        localId: "tt_existing_1",
        personId: "per_2",
        firstName: "Mihai",
        lastName: "",
        email: "",
        dateOfBirth: null,
        role: "child",
      },
    ])
    expect(hydrateVoucher(travelerParty).picked).toMatchObject({
      id: "vch_1",
      code: "SUMMER",
      remainingAmountCents: 2500,
    })
  })

  it("maps already-paid full schedules into booking draft rows", () => {
    expect(
      paymentScheduleToRows(
        {
          mode: "full",
          installments: [
            {
              dueDate: "2026-07-01",
              amountCents: null,
              alreadyPaid: true,
              paymentDate: "2026-06-15",
              paymentMethod: "card",
              paymentReference: "auth_123",
            },
          ],
        },
        "EUR",
        12000,
      ),
    ).toEqual([
      {
        scheduleType: "balance",
        status: "paid",
        dueDate: "2026-07-01",
        currency: "EUR",
        amountCents: 12000,
        notes: "Marked paid in trips; date: 2026-06-15; method: card; reference: auth_123",
      },
    ])
  })

  it("allows reserve when an explicit full payment schedule covers the component total", () => {
    expect(
      paymentScheduleReserveValidationReason([
        tripComponentWithPaymentSchedule({
          mode: "full",
          installments: [
            {
              id: "inst_full",
              amountCents: null,
              dueDate: "2026-07-15",
              alreadyPaid: false,
              paymentDate: null,
              paymentMethod: "bank_transfer",
              paymentReference: "",
            },
          ],
        }),
      ]),
    ).toBeNull()
  })

  it("blocks reserve when split installments no longer match the component total", () => {
    expect(
      paymentScheduleReserveValidationReason([
        tripComponentWithPaymentSchedule({
          mode: "split",
          installments: [
            {
              id: "inst_1",
              amountCents: 64950,
              dueDate: "2026-06-30",
              alreadyPaid: false,
              paymentDate: null,
              paymentMethod: "bank_transfer",
              paymentReference: "",
            },
            {
              id: "inst_2",
              amountCents: 64000,
              dueDate: "2026-07-14",
              alreadyPaid: false,
              paymentDate: null,
              paymentMethod: "bank_transfer",
              paymentReference: "",
            },
          ],
        }),
      ]),
    ).toBe("paymentScheduleSplitTotalMismatch")
  })

  it("recomputes reserve validation from split back to full immediately", () => {
    const splitComponent = tripComponentWithPaymentSchedule({
      mode: "split",
      installments: [
        {
          id: "inst_1",
          amountCents: null,
          dueDate: "2026-06-30",
          alreadyPaid: false,
          paymentDate: null,
          paymentMethod: "bank_transfer",
          paymentReference: "",
        },
        {
          id: "inst_2",
          amountCents: 129900,
          dueDate: "2026-07-14",
          alreadyPaid: false,
          paymentDate: null,
          paymentMethod: "bank_transfer",
          paymentReference: "",
        },
      ],
    })
    const fullComponent = tripComponentWithPaymentSchedule({
      mode: "full",
      installments: [
        {
          id: "inst_full",
          amountCents: null,
          dueDate: "2026-06-30",
          alreadyPaid: false,
          paymentDate: null,
          paymentMethod: "bank_transfer",
          paymentReference: "",
        },
      ],
    })

    expect(paymentScheduleReserveValidationReason([splitComponent])).toBe(
      "paymentScheduleSplitRowsRequired",
    )
    expect(paymentScheduleReserveValidationReason([fullComponent])).toBeNull()
  })

  it("falls back to lead role for the first stored traveler", () => {
    expect(tripTravelerRoleFromStored(undefined, 0)).toBe("lead")
    expect(tripTravelerRoleFromStored("unknown", 1)).toBe("adult")
  })

  it("requires stays to have an ordered date range before add", () => {
    const pending = {
      kind: "stay",
      localId: "pc_stay",
      catalogEntityId: "acc_123",
      catalogEntityName: "Hotel",
      catalogSourceKind: "owned",
      catalogSourceConnectionId: null,
      catalogSourceRef: null,
      catalogThumbnailUrl: null,
      bookingDraft: {
        entity: { module: "accommodations", id: "acc_123", sourceKind: "owned" },
        configure: { pax: { adult: 1 } },
      },
      startsAt: "",
      endsAt: "",
      commitError: null,
    } as const

    expect(pendingComponentIsValid(pending)).toBe(false)
    expect(pendingStayDateRangeIsValid({ startsAt: "2026-07-04", endsAt: "2026-07-04" })).toBe(
      false,
    )
    expect(
      pendingComponentIsValid({
        ...pending,
        startsAt: "2026-07-01T14:00:00.000Z",
        endsAt: "2026-07-04T11:00:00.000Z",
      }),
    ).toBe(true)
  })
})

function tripComponentWithPaymentSchedule(paymentSchedule: Record<string, unknown>): TripComponent {
  return {
    id: "trcp_123",
    kind: "catalog_booking",
    status: "priced",
    bookingId: null,
    componentTotalAmountCents: 129900,
    metadata: {
      bookingSetup: {
        paymentSchedule,
      },
    },
  } as TripComponent
}
