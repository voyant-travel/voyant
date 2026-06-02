import { beforeEach, describe, expect, it, vi } from "vitest"

const travelComposerServiceMock = vi.hoisted(() => ({
  completeTripCheckout: vi.fn(),
  getTrip: vi.fn(),
  updateComponent: vi.fn(),
  updateTrip: vi.fn(),
}))

vi.mock("@voyantjs/travel-composer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@voyantjs/travel-composer")>()
  return {
    ...actual,
    travelComposerService: travelComposerServiceMock,
  }
})

import type { PaymentCompletedEvent } from "@voyantjs/finance"
import type { TripComponent } from "@voyantjs/travel-composer"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  cancelTripForCoreBookingCancellation,
  completeTripPaymentAndFanOut,
} from "./travel-composer-runtime"

describe("completeTripPaymentAndFanOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fans aggregate trip payment completion out to component booking completions", async () => {
    const eventBus = {
      emit: vi.fn(async () => undefined),
      subscribe: vi.fn(),
    }
    const components = [
      component({
        id: "tcmp_core",
        bookingId: "book_core",
        orderId: "BK-CORE",
        componentTotalAmountCents: 120_00,
      }),
      component({
        id: "tcmp_hotel",
        bookingId: "book_hotel",
        orderId: "BK-HOTEL",
        componentTotalAmountCents: 240_00,
      }),
      component({
        id: "tcmp_duplicate",
        bookingId: "book_hotel",
        orderId: "BK-HOTEL",
        componentTotalAmountCents: 10_00,
      }),
      component({
        id: "tcmp_cancelled",
        bookingId: "book_cancelled",
        status: "cancelled",
        componentTotalAmountCents: 40_00,
      }),
      component({ id: "tcmp_manual", bookingId: null, componentTotalAmountCents: 25_00 }),
    ]
    travelComposerServiceMock.completeTripCheckout.mockResolvedValue({
      envelope: { id: "trip_123" },
      components,
      updatedComponentIds: ["tcmp_core", "tcmp_hotel"],
      alreadyCompleted: false,
    })

    await completeTripPaymentAndFanOut({} as PostgresJsDatabase, eventBus, {
      paymentSessionId: "pay_trip",
      targetType: "other",
      targetId: "trip_123",
      bookingId: null,
      orderId: null,
      invoiceId: null,
      bookingPaymentScheduleId: null,
      bookingGuaranteeId: null,
      amountCents: 360_00,
      currency: "EUR",
      provider: "netopia",
    })

    expect(travelComposerServiceMock.completeTripCheckout).toHaveBeenCalledWith(
      {},
      {
        envelopeId: "trip_123",
        paymentSessionId: "pay_trip",
        payload: {
          amountCents: 360_00,
          currency: "EUR",
          provider: "netopia",
          targetType: "other",
          targetId: "trip_123",
        },
      },
    )
    expect(eventBus.emit).toHaveBeenCalledTimes(2)
    expect(eventBus.emit).toHaveBeenNthCalledWith(
      1,
      "payment.completed",
      expect.objectContaining({
        paymentSessionId: "pay_trip",
        targetType: "booking",
        targetId: "book_core",
        bookingId: "book_core",
        orderId: "BK-CORE",
        amountCents: 120_00,
        currency: "EUR",
        provider: "netopia",
      } satisfies Partial<PaymentCompletedEvent>),
      expect.objectContaining({
        source: "subscriber",
        tripEnvelopeId: "trip_123",
        tripComponentId: "tcmp_core",
      }),
    )
    expect(eventBus.emit).toHaveBeenNthCalledWith(
      2,
      "payment.completed",
      expect.objectContaining({
        targetType: "booking",
        targetId: "book_hotel",
        bookingId: "book_hotel",
        orderId: "BK-HOTEL",
        amountCents: 240_00,
      } satisfies Partial<PaymentCompletedEvent>),
      expect.objectContaining({
        tripComponentId: "tcmp_hotel",
      }),
    )
  })

  it("cancels a materialized package trip when the core booking is released for inquiry", async () => {
    const core = component({
      id: "tcmp_core",
      bookingId: "book_core",
      status: "held",
      metadata: {
        catalogBooking: {
          committedBookingId: "book_core",
        },
      },
    })
    const sibling = component({
      id: "tcmp_sibling",
      bookingId: null,
      status: "draft",
    })
    const alreadyCancelled = component({
      id: "tcmp_cancelled",
      bookingId: "book_cancelled",
      status: "cancelled",
    })
    travelComposerServiceMock.getTrip.mockResolvedValue({
      envelope: {
        id: "trip_123",
        constraints: { committedBookingId: "book_core" },
      },
      components: [core, sibling, alreadyCancelled],
    })
    const db = dbWithTripComponents([core])

    await cancelTripForCoreBookingCancellation(db, {
      bookingId: "book_core",
      bookingNumber: "BK-1",
      previousStatus: "on_hold",
      actorId: null,
    })

    expect(travelComposerServiceMock.updateComponent).toHaveBeenCalledTimes(2)
    expect(travelComposerServiceMock.updateComponent.mock.calls).toEqual([
      [db, "tcmp_core", { status: "cancelled" }],
      [db, "tcmp_sibling", { status: "cancelled" }],
    ])
    expect(travelComposerServiceMock.updateTrip).toHaveBeenCalledWith(db, "trip_123", {
      status: "cancelled",
    })
  })

  it("only cancels the matching component when a non-core sibling booking is cancelled", async () => {
    const sibling = component({
      id: "tcmp_sibling",
      bookingId: "book_sibling",
      status: "held",
    })
    travelComposerServiceMock.getTrip.mockResolvedValue({
      envelope: {
        id: "trip_123",
        constraints: { committedBookingId: "book_core" },
      },
      components: [sibling],
    })
    const db = dbWithTripComponents([sibling])

    await cancelTripForCoreBookingCancellation(db, {
      bookingId: "book_sibling",
      bookingNumber: "BK-2",
      previousStatus: "on_hold",
      actorId: null,
    })

    expect(travelComposerServiceMock.updateComponent).toHaveBeenCalledTimes(1)
    expect(travelComposerServiceMock.updateComponent).toHaveBeenCalledWith(db, "tcmp_sibling", {
      status: "cancelled",
    })
    expect(travelComposerServiceMock.updateTrip).not.toHaveBeenCalled()
  })
})

function component(overrides: Partial<TripComponent>): TripComponent {
  return {
    id: "tcmp_1",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "catalog_booking",
    status: "booked",
    title: null,
    description: null,
    entityModule: "products",
    entityId: "prod_1",
    sourceKind: "owned",
    sourceConnectionId: null,
    sourceRef: null,
    bookingDraftId: null,
    catalogQuoteId: null,
    bookingId: "book_1",
    bookingGroupId: null,
    orderId: null,
    paymentSessionId: "pay_trip",
    providerRef: null,
    supplierRef: null,
    componentCurrency: "EUR",
    componentSubtotalAmountCents: null,
    componentTaxAmountCents: null,
    componentTotalAmountCents: null,
    pricingSnapshot: null,
    taxLines: [],
    cancellationSnapshot: null,
    holdToken: null,
    holdExpiresAt: null,
    priceExpiresAt: null,
    warningCodes: [],
    metadata: {},
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    ...overrides,
  }
}

function dbWithTripComponents(components: TripComponent[]): PostgresJsDatabase {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => components),
      })),
    })),
  } as unknown as PostgresJsDatabase
}
