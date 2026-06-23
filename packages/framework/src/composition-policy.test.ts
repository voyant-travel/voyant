import type { CompositionContext } from "@voyant-travel/hono/composition"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type FrameworkProviders, frameworkComposition } from "./composition.js"

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

vi.mock("@voyant-travel/finance", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    createFinanceHonoModule: mocks.createFinanceHonoModule,
  }
})

vi.mock("@voyant-travel/notifications", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    createNotificationsHonoModule: mocks.createNotificationsHonoModule,
  }
})

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

  it("passes injected finance checkout policy to the standard finance module", () => {
    const policy = { defaultCardCollectionDocumentType: "proforma" } as const

    frameworkComposition.modules["@voyant-travel/finance"]?.(
      compositionContext({ financeCheckoutPolicy: policy }),
    )

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(expect.objectContaining({ policy }))
  })

  it("leaves finance checkout policy unset by default", () => {
    frameworkComposition.modules["@voyant-travel/finance"]?.(compositionContext())

    expect(mocks.createFinanceHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ policy: undefined }),
    )
  })

  it("passes injected notifications auto-dispatch policy to the standard notifications module", () => {
    const autoConfirmAndDispatch = {
      enabled: false,
      templateSlug: "booking-confirmation",
    } as const

    frameworkComposition.modules["@voyant-travel/notifications"]?.(
      compositionContext({ notificationsAutoConfirmAndDispatch: autoConfirmAndDispatch }),
    )

    expect(mocks.createNotificationsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({ autoConfirmAndDispatch }),
    )
  })

  it("merges partial notifications auto-dispatch policy with the standard default", () => {
    frameworkComposition.modules["@voyant-travel/notifications"]?.(
      compositionContext({
        notificationsAutoConfirmAndDispatch: {
          templateSlug: "custom-booking-confirmation",
          documentTypes: ["contract"],
        },
      }),
    )

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

  it("keeps the standard notifications auto-dispatch default", () => {
    frameworkComposition.modules["@voyant-travel/notifications"]?.(compositionContext())

    expect(mocks.createNotificationsHonoModule).toHaveBeenCalledWith(
      expect.objectContaining({
        autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
      }),
    )
  })
})
