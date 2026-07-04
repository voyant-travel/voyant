import { describe, expect, it, vi } from "vitest"

const checkoutMocks = vi.hoisted(() => ({
  dispatchCheckoutFinalize: vi.fn(async () => ({ runId: "run_1" })),
  persistAcceptanceSignature: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  withDbFromEnv: vi.fn(async (_env, cb: (db: unknown) => Promise<unknown>) => cb({ raw: true })),
}))

const runtimeMocks = vi.hoisted(() => ({
  operatorBindings: vi.fn((bindings: unknown) => bindings),
  operatorPostgresDb: vi.fn((rawDb: unknown) => rawDb),
}))

vi.mock("@voyant-travel/commerce/checkout", () => checkoutMocks)
vi.mock("../lib/db", () => dbMocks)
vi.mock("../runtime/operator-runtime-adapter", () => runtimeMocks)

import { createCatalogCheckoutBundle } from "./catalog-checkout-finalize-runtime"

type SubscribeOptions = { inline?: boolean }
type Handler = (
  envelope: { data: unknown },
  context?: { eventBus: unknown },
) => Promise<void> | void

function createRecordingBus() {
  const subscriptions: Array<{
    event: string
    handler: Handler
    options: SubscribeOptions | undefined
  }> = []

  return {
    subscriptions,
    bus: {
      subscribe(event: string, handler: Handler, options?: SubscribeOptions) {
        subscriptions.push({ event, handler, options })
        return { unsubscribe() {} }
      },
      emit: vi.fn(),
    },
  }
}

describe("catalog checkout finalize subscriber", () => {
  it("runs payment completion finalization inline with the emitting request", () => {
    const { bus, subscriptions } = createRecordingBus()

    createCatalogCheckoutBundle({}).bootstrap?.({
      bindings: {} as never,
      container: {} as never,
      eventBus: bus as never,
    })

    expect(subscriptions.find((sub) => sub.event === "payment.completed")?.options).toEqual({
      inline: true,
    })
  })

  it("uses the scheduler-scoped handler bus for nested checkout events", async () => {
    const { bus, subscriptions } = createRecordingBus()
    const scopedBus = { emit: vi.fn(), subscribe: vi.fn() }

    createCatalogCheckoutBundle({}).bootstrap?.({
      bindings: {} as never,
      container: {} as never,
      eventBus: bus as never,
    })

    await subscriptions
      .find((sub) => sub.event === "payment.completed")
      ?.handler(
        {
          data: {
            bookingId: "book_1",
            paymentSessionId: "ps_1",
            paymentIntent: "card",
          },
        },
        { eventBus: scopedBus },
      )

    expect(checkoutMocks.dispatchCheckoutFinalize).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: scopedBus,
        input: expect.objectContaining({
          bookingId: "book_1",
          paymentSessionId: "ps_1",
          paymentIntent: "card",
        }),
      }),
    )
  })
})
