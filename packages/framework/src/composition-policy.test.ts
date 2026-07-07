import type { CompositionContext } from "@voyant-travel/hono/composition"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"

const mocks = vi.hoisted(() => ({
  createFinanceHonoModule: vi.fn((options: unknown) => ({
    module: { name: "finance" },
    options,
  })),
  createNotificationsHonoModule: vi.fn((options: unknown) => ({
    module: { name: "notifications" },
    options,
  })),
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
    mocks.createFinanceHonoModule.mockClear()
    mocks.createNotificationsHonoModule.mockClear()
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
    const catalogContent = frameworkComposition.modules["operator/catalog-content"]?.(
      compositionContext(),
    )
    if (Array.isArray(catalogContent)) throw new Error("expected a single catalog-content module")

    expect(catalogContent?.lazyRoutes?.paths).toEqual(
      expect.arrayContaining([
        "/v1/admin/cruises/:id/content",
        "/v1/public/cruises/:id/content",
        "/v1/admin/cruises/:id/sailings/:sailingExternalId/pricing",
        "/v1/public/cruises/:id/sailings/:sailingExternalId/pricing",
      ]),
    )
  })
})
