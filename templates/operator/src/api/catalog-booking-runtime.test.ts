import { beforeEach, describe, expect, it, vi } from "vitest"

const travelComposerServiceMock = vi.hoisted(() => ({
  createTrip: vi.fn(),
  addComponent: vi.fn(),
  updateComponent: vi.fn(),
  updateComponentRefs: vi.fn(),
  completeTripCheckout: vi.fn(),
}))

const listComponentsMock = vi.hoisted(() => vi.fn())

vi.mock("@voyantjs/travel-composer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@voyantjs/travel-composer")>()
  return {
    ...actual,
    travelComposerService: travelComposerServiceMock,
  }
})

vi.mock("@voyantjs/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@voyantjs/products")>()
  return {
    ...actual,
    productsService: {
      ...actual.productsService,
      listComponents: listComponentsMock,
    },
  }
})

import {
  materializeIndependentComponentTrip,
  withIndependentComponentTripReference,
} from "./catalog-booking-runtime"
import { completeTripPaymentAndFanOut } from "./travel-composer-runtime"

describe("materializeIndependentComponentTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a trip envelope with the committed core booking and independent siblings", async () => {
    const db = makeDb([])
    listComponentsMock.mockResolvedValue({
      data: [independentActivityComponentRow()],
      total: 1,
      limit: 100,
      offset: 0,
    })
    travelComposerServiceMock.createTrip.mockResolvedValue({ envelope: { id: "trip_1" } })
    travelComposerServiceMock.addComponent.mockImplementation(async (_db, input) => ({
      id: input.sequence === 0 ? "tcmp_core" : `tcmp_independent_${String(input.sequence ?? 0)}`,
      ...input,
      status: "draft",
    }))
    travelComposerServiceMock.updateComponent.mockResolvedValue({})
    travelComposerServiceMock.updateComponentRefs.mockResolvedValue({})

    await materializeIndependentComponentTrip({
      db,
      request: {
        parameters: { draft: bookingDraft() },
      },
      result: {
        bookingId: "catalog_book_1",
        orderRef: "BK-1",
        status: "held",
        snapshotId: "snap_1",
        upstreamPayload: { bridgeBookingId: "book_finance_1" },
      },
    } as never)

    expect(travelComposerServiceMock.createTrip).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        title: "Package booking BK-1",
        constraints: expect.objectContaining({
          catalogBookingId: "catalog_book_1",
          committedBookingId: "book_finance_1",
        }),
      }),
    )
    expect(travelComposerServiceMock.addComponent).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({
        envelopeId: "trip_1",
        sequence: 0,
        kind: "catalog_booking",
        catalogRef: {
          entityModule: "products",
          entityId: "prod_package",
          sourceKind: "owned",
        },
      }),
    )
    expect(travelComposerServiceMock.updateComponent).toHaveBeenNthCalledWith(1, db, "tcmp_core", {
      status: "priced",
    })
    expect(travelComposerServiceMock.updateComponentRefs).toHaveBeenCalledWith(db, "tcmp_core", {
      committedRef: {
        bookingId: "book_finance_1",
        orderId: "BK-1",
        providerRef: "BK-1",
        supplierRef: "BK-1",
      },
    })
    expect(travelComposerServiceMock.updateComponent).toHaveBeenNthCalledWith(2, db, "tcmp_core", {
      status: "held",
    })
    expect(travelComposerServiceMock.addComponent).toHaveBeenNthCalledWith(
      2,
      db,
      expect.objectContaining({
        envelopeId: "trip_1",
        sequence: 1,
        kind: "catalog_booking",
        catalogRef: {
          entityModule: "products",
          entityId: "prod_excursion",
          sourceKind: "owned",
        },
        metadata: expect.objectContaining({
          productComponent: expect.objectContaining({
            componentId: "pcmp_excursion",
            choiceId: "rafting",
            commitmentBoundary: "independent_component",
          }),
        }),
      }),
    )
  })

  it("skips materialization when the committed booking already has a trip component", async () => {
    const db = makeDb([{ id: "tcmp_existing", envelopeId: "trip_existing" }])

    await materializeIndependentComponentTrip({
      db,
      request: {
        parameters: { draft: bookingDraft() },
      },
      result: {
        bookingId: "catalog_book_1",
        orderRef: "BK-1",
        status: "held",
        snapshotId: "snap_1",
        upstreamPayload: { bridgeBookingId: "book_finance_1" },
      },
    } as never)

    expect(listComponentsMock).not.toHaveBeenCalled()
    expect(travelComposerServiceMock.createTrip).not.toHaveBeenCalled()
  })

  it("adds the trip envelope reference to the book result upstream payload", async () => {
    const result = await withIndependentComponentTripReference(
      makeDb([{ id: "tcmp_core", envelopeId: "trip_1" }]),
      {
        bookingId: "catalog_book_1",
        orderRef: "BK-1",
        status: "held",
        snapshotId: "snap_1",
        upstreamPayload: { bridgeBookingId: "book_finance_1" },
      },
    )

    expect(result.upstreamPayload).toEqual({
      bridgeBookingId: "book_finance_1",
      tripEnvelopeId: "trip_1",
      tripComponentId: "tcmp_core",
    })
  })

  it("regresses package booking handoff through aggregate trip payment completion", async () => {
    const db = makeDb([])
    const materializedComponents: Array<{
      id: string
      envelopeId: string
      sequence?: number
      bookingId: string | null
      orderId: string | null
      status: "draft" | "held" | "booked"
      componentTotalAmountCents: number | null
      componentCurrency: string | null
    }> = []
    listComponentsMock.mockResolvedValue({
      data: [independentActivityComponentRow()],
      total: 1,
      limit: 100,
      offset: 0,
    })
    travelComposerServiceMock.createTrip.mockResolvedValue({ envelope: { id: "trip_1" } })
    travelComposerServiceMock.addComponent.mockImplementation(async (_db, input) => {
      const component = {
        id: input.sequence === 0 ? "tcmp_core" : "tcmp_excursion",
        envelopeId: input.envelopeId,
        sequence: input.sequence,
        bookingId: null,
        orderId: null,
        status: "draft" as const,
        componentTotalAmountCents: input.sequence === 0 ? 120_00 : 80_00,
        componentCurrency: "EUR",
      }
      materializedComponents.push(component)
      return component
    })
    travelComposerServiceMock.updateComponent.mockImplementation(
      async (_db, componentId, patch) => {
        const component = materializedComponents.find((item) => item.id === componentId)
        if (component && patch.status) component.status = patch.status
        return component
      },
    )
    travelComposerServiceMock.updateComponentRefs.mockImplementation(
      async (_db, componentId, refs) => {
        const component = materializedComponents.find((item) => item.id === componentId)
        if (component) {
          component.bookingId = refs.committedRef?.bookingId ?? null
          component.orderId = refs.committedRef?.orderId ?? null
        }
        return component
      },
    )

    const bookResult = {
      bookingId: "catalog_book_1",
      orderRef: "BK-1",
      status: "held",
      snapshotId: "snap_1",
      upstreamPayload: { bridgeBookingId: "book_core" },
    } as never
    await materializeIndependentComponentTrip({
      db,
      request: {
        parameters: { draft: bookingDraft() },
      },
      result: bookResult,
    } as never)

    const transformed = await withIndependentComponentTripReference(
      makeDb([{ id: "tcmp_core", envelopeId: "trip_1" }]),
      bookResult,
    )
    expect(transformed.upstreamPayload).toEqual({
      bridgeBookingId: "book_core",
      tripEnvelopeId: "trip_1",
      tripComponentId: "tcmp_core",
    })
    expect(materializedComponents.map((item) => [item.id, item.status, item.bookingId])).toEqual([
      ["tcmp_core", "held", "book_core"],
      ["tcmp_excursion", "draft", null],
    ])

    travelComposerServiceMock.completeTripCheckout.mockResolvedValue({
      envelope: { id: "trip_1", status: "booked" },
      components: [
        {
          ...tripComponentPaymentRow("tcmp_core", "book_core", "BK-1", 120_00),
          paymentSessionId: "pay_trip",
        },
        tripComponentPaymentRow("tcmp_excursion", "book_excursion", "BK-EX", 80_00),
        tripComponentPaymentRow("tcmp_duplicate", "book_excursion", "BK-EX", 80_00),
      ],
      updatedComponentIds: ["tcmp_core", "tcmp_excursion"],
      alreadyCompleted: false,
    })
    const eventBus = {
      emit: vi.fn(async () => undefined),
      subscribe: vi.fn(),
    }

    await completeTripPaymentAndFanOut(db as never, eventBus, {
      paymentSessionId: "pay_trip",
      targetType: "other",
      targetId: "trip_1",
      bookingId: null,
      orderId: null,
      invoiceId: null,
      bookingPaymentScheduleId: null,
      bookingGuaranteeId: null,
      amountCents: 200_00,
      currency: "EUR",
      provider: "netopia",
    })

    expect(travelComposerServiceMock.completeTripCheckout).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        envelopeId: "trip_1",
        paymentSessionId: "pay_trip",
      }),
    )
    expect(eventBus.emit).toHaveBeenCalledTimes(2)
    expect(eventBus.emit).toHaveBeenNthCalledWith(
      1,
      "payment.completed",
      expect.objectContaining({
        targetType: "booking",
        targetId: "book_core",
        bookingId: "book_core",
        orderId: "BK-1",
        amountCents: 120_00,
      }),
      expect.objectContaining({ tripEnvelopeId: "trip_1", tripComponentId: "tcmp_core" }),
    )
    expect(eventBus.emit).toHaveBeenNthCalledWith(
      2,
      "payment.completed",
      expect.objectContaining({
        targetType: "booking",
        targetId: "book_excursion",
        bookingId: "book_excursion",
        orderId: "BK-EX",
        amountCents: 80_00,
      }),
      expect.objectContaining({ tripEnvelopeId: "trip_1", tripComponentId: "tcmp_excursion" }),
    )
  })
})

function makeDb(existingComponents: Array<{ id: string; envelopeId: string }>) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => existingComponents),
        })),
      })),
    })),
  }
}

function bookingDraft() {
  return {
    entity: {
      module: "products",
      id: "prod_package",
      sourceKind: "owned",
    },
    configure: {
      pax: { adult: 2 },
      componentSelections: [{ componentId: "pcmp_excursion", choiceId: "rafting", quantity: 1 }],
    },
    billing: {
      buyerType: "B2C",
      contact: {
        firstName: "Ana",
        lastName: "Ionescu",
        email: "ana@example.com",
      },
      address: {},
    },
    travelers: [
      {
        firstName: "Ana",
        lastName: "Ionescu",
        email: "ana@example.com",
        band: "adult",
      },
    ],
    payment: { intent: "hold" },
  }
}

function independentActivityComponentRow() {
  return {
    id: "pcmp_excursion",
    componentKind: "activity",
    title: "Optional excursion",
    summary: null,
    description: null,
    selection: "optional",
    commitmentBoundary: "independent_component",
    priceDisposition: "add_on",
    required: false,
    quantity: null,
    sortOrder: 0,
    binding: {
      type: "inline",
      content: {
        title: "Optional excursion",
        inclusions: [],
        media: [],
      },
    },
    choices: [
      {
        id: "rafting",
        title: "Rafting",
        ref: {
          entity_module: "products",
          entity_id: "prod_excursion",
          source_kind: "owned",
        },
      },
    ],
    media: [],
    tags: [],
    metadata: null,
  }
}

function tripComponentPaymentRow(
  id: string,
  bookingId: string,
  orderId: string,
  amountCents: number,
) {
  return {
    id,
    envelopeId: "trip_1",
    sequence: 0,
    kind: "catalog_booking",
    status: "booked",
    title: null,
    description: null,
    entityModule: "products",
    entityId: "prod_excursion",
    sourceKind: "owned",
    sourceConnectionId: null,
    sourceRef: null,
    bookingDraftId: null,
    catalogQuoteId: null,
    bookingId,
    bookingGroupId: null,
    orderId,
    paymentSessionId: null,
    providerRef: orderId,
    supplierRef: orderId,
    componentCurrency: "EUR",
    componentSubtotalAmountCents: amountCents,
    componentTaxAmountCents: 0,
    componentTotalAmountCents: amountCents,
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
  }
}
