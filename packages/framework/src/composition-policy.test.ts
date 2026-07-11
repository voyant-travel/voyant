import { createContainer } from "@voyant-travel/core"
import type { CompositionContext } from "@voyant-travel/hono/composition"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"

const mocks = vi.hoisted(() => ({
  createBookingsHonoModule: vi.fn((options: unknown) => ({
    module: { name: "bookings" },
    adminRoutes: {},
    publicRoutes: {},
    options,
  })),
  createFinanceHonoModule: vi.fn((options: unknown) => ({
    module: { name: "finance" },
    options,
  })),
  createNotificationsHonoModule: vi.fn((options: unknown) => ({
    module: { name: "notifications" },
    options,
  })),
  enrichStayBookingOverviewItems: vi.fn(),
}))

vi.mock("@voyant-travel/accommodations/booking-overview-enricher", () => ({
  enrichStayBookingOverviewItems: mocks.enrichStayBookingOverviewItems,
}))

vi.mock("@voyant-travel/bookings", () => ({
  createBookingsHonoModule: mocks.createBookingsHonoModule,
}))

vi.mock("@voyant-travel/finance", () => ({
  createFinanceHonoModule: mocks.createFinanceHonoModule,
}))

vi.mock("@voyant-travel/notifications", () => ({
  createDefaultBookingDocumentAttachment: vi.fn(),
  createNotificationService: vi.fn(),
  createNotificationsHonoModule: mocks.createNotificationsHonoModule,
  notificationsService: {
    listReminderRuns: vi.fn(),
    sendInvoiceNotification: vi.fn(),
    sendPaymentSessionNotification: vi.fn(),
  },
}))

function compositionContext(
  capabilities: Partial<FrameworkProviders> = {},
): CompositionContext<FrameworkProviders> {
  return {
    capabilities: capabilities as FrameworkProviders,
    options: {},
  }
}

describe("frameworkComposition policy injection", () => {
  beforeEach(() => {
    mocks.createBookingsHonoModule.mockClear()
    mocks.createFinanceHonoModule.mockClear()
    mocks.createNotificationsHonoModule.mockClear()
  })

  it("wires accommodation overview enrichment into the standard bookings module", async () => {
    const bookings = frameworkComposition.modules["@voyant-travel/bookings"]?.(
      compositionContext({
        relationshipsService: {
          getOrganizationById: vi.fn(),
          getPersonById: vi.fn(),
          loadPersonTravelSnapshot: vi.fn(),
          upsertPersonFromContact: vi.fn(),
        },
        closePaymentSchedulesForBooking: vi.fn(),
      }),
    )
    if (Array.isArray(bookings)) throw new Error("expected a single bookings module")
    await bookings?.lazyPublicRoutes?.()

    expect(mocks.createBookingsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({
        overviewItemEnrichers: {
          accommodation: mocks.enrichStayBookingOverviewItems,
        },
      }),
    )
  })

  it("passes injected finance checkout policy to the standard finance module", async () => {
    const policy = { defaultCardCollectionDocumentType: "proforma" } as const

    const finance = frameworkComposition.modules["@voyant-travel/finance"]?.(
      compositionContext({ financeCheckoutPolicy: policy }),
    )
    if (Array.isArray(finance)) throw new Error("expected a single finance module")
    await finance?.lazyAdminRoutes?.()

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(expect.objectContaining({ policy }))
  })

  it("leaves finance checkout policy unset by default", async () => {
    const finance = frameworkComposition.modules["@voyant-travel/finance"]?.(compositionContext())
    if (Array.isArray(finance)) throw new Error("expected a single finance module")
    await finance?.lazyAdminRoutes?.()

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ policy: undefined }),
    )
  })

  it("passes injected finance payment-schedule line format to the standard finance module", async () => {
    const finance = frameworkComposition.modules["@voyant-travel/finance"]?.(
      compositionContext({ financePaymentScheduleLineDescriptionFormat: "product_only" }),
    )
    if (Array.isArray(finance)) throw new Error("expected a single finance module")
    await finance?.lazyAdminRoutes?.()

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ paymentScheduleLineDescriptionFormat: "product_only" }),
    )
  })

  it("leaves finance payment-schedule line format unset by default", async () => {
    const finance = frameworkComposition.modules["@voyant-travel/finance"]?.(compositionContext())
    if (Array.isArray(finance)) throw new Error("expected a single finance module")
    await finance?.lazyAdminRoutes?.()

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ paymentScheduleLineDescriptionFormat: undefined }),
    )
  })

  it("passes injected notifications auto-dispatch policy to the standard notifications module", async () => {
    const autoConfirmAndDispatch = {
      enabled: false,
      templateSlug: "booking-confirmation",
    } as const

    const notifications = frameworkComposition.modules["@voyant-travel/notifications"]?.(
      compositionContext({ notificationsAutoConfirmAndDispatch: autoConfirmAndDispatch }),
    )
    if (Array.isArray(notifications)) throw new Error("expected a single notifications module")
    await notifications?.lazyAdminRoutes?.()

    expect(mocks.createNotificationsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ autoConfirmAndDispatch }),
    )
  })

  it("merges partial notifications auto-dispatch policy with the standard default", async () => {
    const notifications = frameworkComposition.modules["@voyant-travel/notifications"]?.(
      compositionContext({
        notificationsAutoConfirmAndDispatch: {
          templateSlug: "custom-booking-confirmation",
          documentTypes: ["contract"],
        },
      }),
    )
    if (Array.isArray(notifications)) throw new Error("expected a single notifications module")
    await notifications?.lazyAdminRoutes?.()

    expect(mocks.createNotificationsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({
        autoConfirmAndDispatch: {
          enabled: true,
          templateSlug: "custom-booking-confirmation",
          documentTypes: ["contract"],
        },
      }),
    )
  })

  it("keeps the standard notifications auto-dispatch default", async () => {
    const notifications = frameworkComposition.modules["@voyant-travel/notifications"]?.(
      compositionContext(),
    )
    if (Array.isArray(notifications)) throw new Error("expected a single notifications module")
    await notifications?.lazyAdminRoutes?.()

    expect(mocks.createNotificationsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({
        autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
      }),
    )
  })

  it("registers all cruise catalog-content lazy route shapes", () => {
    const catalogContent = frameworkComposition.extensions?.[
      "@voyant-travel/cruises/content-extension"
    ]?.(compositionContext())
    if (Array.isArray(catalogContent)) throw new Error("expected one cruises content extension")

    expect(catalogContent?.lazyRoutes?.paths).toEqual(
      expect.arrayContaining([
        "/v1/admin/cruises/:id/content",
        "/v1/public/cruises/:id/content",
        "/v1/admin/cruises/:id/sailings/:sailingExternalId/pricing",
        "/v1/public/cruises/:id/sailings/:sailingExternalId/pricing",
      ]),
    )
  })

  it("registers the booking-schedule subscriber runtime for every graph host", async () => {
    const db = { source: "managed" }
    const options = { resolveDb: vi.fn() }
    const withDb = vi.fn(async (_bindings, operation) => operation(db as never))
    const extension = frameworkComposition.extensions?.[
      "@voyant-travel/finance/booking-schedule-extension"
    ]?.(
      compositionContext({
        createBookingScheduleRoutesOptions: () => options as never,
        loadBookingScheduleAdminRoutes: vi.fn(),
        loadPaymentPolicyPublicRoutes: vi.fn(),
        resolveDb: () => db as never,
        withDb,
      }),
    )
    if (Array.isArray(extension)) throw new Error("expected one booking-schedule extension")
    const container = createContainer()
    await extension?.extension.bootstrap?.({ container, bindings: { host: "managed" } } as never)
    const { BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY } = await import(
      "@voyant-travel/finance/booking-schedule-subscriber"
    )
    const runtime = container.resolve<{
      resolveRoutesOptions(): unknown
      withDb<T>(bindings: unknown, operation: (value: unknown) => Promise<T>): Promise<T>
    }>(BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY)

    expect(await runtime.resolveRoutesOptions()).toBe(options)
    await expect(runtime.withDb({}, async (value) => value)).resolves.toBe(db)
    expect(withDb).toHaveBeenCalledOnce()
  })

  it("registers the Trips subscriber database runtime in standard graph hosts", async () => {
    const db = { source: "managed" }
    const withDb = vi.fn(async (_bindings, operation) => operation(db as never))
    const trips = frameworkComposition.modules["@voyant-travel/trips"]?.(
      compositionContext({
        createTripsRoutesOptions: async () => ({}),
        resolveDb: () => db as never,
        withDb,
      }),
    )
    if (Array.isArray(trips)) throw new Error("expected a single trips module")
    const container = createContainer()
    await trips?.module.bootstrap?.({ container, bindings: { host: "managed" } } as never)
    const { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } = await import(
      "@voyant-travel/trips/payment-subscribers"
    )
    const runtime = container.resolve<{
      withDb<T>(operation: (value: unknown) => Promise<T>): Promise<T>
    }>(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY)

    await expect(runtime.withDb(async (value) => value)).resolves.toBe(db)
    expect(withDb).toHaveBeenCalledOnce()
  })
})
