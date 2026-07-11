import { createContainer } from "@voyant-travel/core"
import type { CompositionContext } from "@voyant-travel/hono/composition"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"

const mocks = vi.hoisted(() => ({
  createNotificationsHonoModule: vi.fn((options: unknown) => ({
    module: { name: "notifications" },
    options,
  })),
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

describe("remaining framework composition policy injection", () => {
  beforeEach(() => {
    mocks.createNotificationsHonoModule.mockClear()
  })

  it("passes injected notifications auto-dispatch policy to Notifications", async () => {
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

  it("merges partial notifications policy with the standard default", async () => {
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

  it("registers the Trips subscriber database runtime in graph hosts", async () => {
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
