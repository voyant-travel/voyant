import { createContainer, createEventBus } from "@voyantjs/core"
import type { KmsProvider } from "@voyantjs/utils"
import { describe, expect, it, vi } from "vitest"

import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntime,
  createBookingsHonoModule,
} from "../../src/index.js"

describe("createBookingsHonoModule.bootstrap", () => {
  it("registers the shared bookings route runtime once", async () => {
    const module = createBookingsHonoModule()
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
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub for the test
      encrypt: vi.fn() as any,
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub for the test
      decrypt: vi.fn() as any,
    }
    const resolveKmsProvider = vi.fn(async () => fakeKms)

    const module = createBookingsHonoModule({ resolveKmsProvider })
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
})
