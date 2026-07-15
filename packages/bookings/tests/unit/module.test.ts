import { createContainer, createEventBus } from "@voyant-travel/core"
import type { KmsProvider } from "@voyant-travel/utils"
import { describe, expect, it, vi } from "vitest"

import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntime,
  createBookingsApiModule,
} from "../../src/index.js"

describe("createBookingsApiModule.bootstrap", () => {
  it("registers the shared bookings route runtime once", async () => {
    const module = createBookingsApiModule()
    const container = createContainer()

    await module.module.bootstrap?.({
      bindings: {
        KMS_PROVIDER: "env",
        KMS_LOCAL_KEY: "test-key",
      },
      container,
      eventBus: createEventBus(),
    })

    const runtime = container.resolve<{
      getKmsProvider: () => unknown
    }>(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(runtime.getKmsProvider).toBeTypeOf("function")
  })

  it("uses an injected resolveKmsProvider instead of reading env", async () => {
    const fakeKms: KmsProvider = {
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub for the test -- owner: bookings; existing suppression is intentional pending typed cleanup.
      encrypt: vi.fn() as any,
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub for the test -- owner: bookings; existing suppression is intentional pending typed cleanup.
      decrypt: vi.fn() as any,
    }
    const resolveKmsProvider = vi.fn(async () => fakeKms)

    const module = createBookingsApiModule({ resolveKmsProvider })
    const container = createContainer()

    await module.module.bootstrap?.({
      // Deliberately empty: the resolver must be used in place of any
      // env-based default.
      bindings: {},
      container,
      eventBus: createEventBus(),
    })

    const runtime = container.resolve<BookingRouteRuntime>(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY)
    const resolved = await runtime.getKmsProvider()

    expect(resolveKmsProvider).toHaveBeenCalledTimes(1)
    expect(resolved).toBe(fakeKms)
  })

  it("registers injected billing-party reference resolvers", async () => {
    const resolveBillingPersonById = vi.fn(async () => true)
    const resolveBillingOrganizationById = vi.fn(async () => true)
    const module = createBookingsApiModule({
      resolveBillingPersonById,
      resolveBillingOrganizationById,
    })
    const container = createContainer()

    await module.module.bootstrap?.({
      bindings: {
        KMS_PROVIDER: "env",
        KMS_LOCAL_KEY: "test-key",
      },
      container,
      eventBus: createEventBus(),
    })

    const runtime = container.resolve<BookingRouteRuntime>(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(runtime.resolveBillingPersonById).toBe(resolveBillingPersonById)
    expect(runtime.resolveBillingOrganizationById).toBe(resolveBillingOrganizationById)
  })
})
