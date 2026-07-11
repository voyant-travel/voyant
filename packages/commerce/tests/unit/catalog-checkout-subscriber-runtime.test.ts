import type { EventEnvelope } from "@voyant-travel/core"
import { createContainer, createEventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import type { AcceptanceSignatureLegalPort } from "../../src/checkout/acceptance-signature.js"
import {
  COMMERCE_ACCEPTANCE_SIGNATURE_SUBSCRIBER_ID,
  COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID,
  createAcceptanceSignatureSubscriberRuntime,
  createCheckoutFinalizeSubscriberRuntime,
} from "../../src/checkout/subscriber-runtime.js"

type Handler = (
  event: EventEnvelope,
  context?: { eventBus: ReturnType<typeof createEventBus> },
) => Promise<void> | void

function recordingEventBus() {
  const eventBus = createEventBus()
  const subscriptions: Array<{ eventType: string; handler: Handler; inline: boolean }> = []
  vi.spyOn(eventBus, "subscribe").mockImplementation((eventType, handler, options) => {
    subscriptions.push({
      eventType,
      handler: handler as Handler,
      inline: options?.inline ?? false,
    })
    return { unsubscribe: vi.fn() }
  })
  return { eventBus, subscriptions }
}

function event(name: string, data: unknown): EventEnvelope {
  return { name, data, emittedAt: new Date().toISOString(), metadata: undefined }
}

const legalPort = {
  getContract: vi.fn(),
  listSignatures: vi.fn(),
  sendContract: vi.fn(),
  signContract: vi.fn(),
} as unknown as AcceptanceSignatureLegalPort

describe("catalog-checkout subscriber runtimes", () => {
  it("injects the Legal port into acceptance-signature persistence", async () => {
    const db = {} as PostgresJsDatabase
    const bindings = { DATABASE_URL: "postgres://commerce" }
    const persistSignature = vi.fn(async () => {})
    const withDb = vi.fn(async (_bindings, operation) => operation(db))
    const { eventBus, subscriptions } = recordingEventBus()
    const descriptor = createAcceptanceSignatureSubscriberRuntime({
      legal: legalPort,
      withDb,
      persistSignature,
    })

    await descriptor.register({ bindings, container: createContainer(), eventBus })
    await subscriptions[0]?.handler(
      event("contract.document.generated", { contractId: "contract_1" }),
    )

    expect(descriptor).toMatchObject({
      id: COMMERCE_ACCEPTANCE_SIGNATURE_SUBSCRIBER_ID,
      eventType: "contract.document.generated",
    })
    expect(withDb).toHaveBeenCalledWith(bindings, expect.any(Function))
    expect(persistSignature).toHaveBeenCalledWith(db, "contract_1", eventBus, legalPort)
  })

  it("logs and swallows acceptance-signature failures", async () => {
    const error = new Error("legal unavailable")
    const logger = { error: vi.fn() }
    const { eventBus, subscriptions } = recordingEventBus()
    const descriptor = createAcceptanceSignatureSubscriberRuntime({
      legal: legalPort,
      withDb: async () => {
        throw error
      },
      logger,
    })
    await descriptor.register({ bindings: {}, container: createContainer(), eventBus })

    await expect(
      subscriptions[0]?.handler(event("contract.document.generated", { contractId: "contract_2" })),
    ).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      "[catalog-checkout] persistAcceptanceSignature failed",
      error,
    )
  })

  it("finalizes booking payments inline with the delivery-scoped event bus", async () => {
    const db = {} as PostgresJsDatabase
    const scopedEventBus = createEventBus()
    const dispatchFinalize = vi.fn(async () => ({ runId: "run_1" }))
    const withDb = vi.fn(async (_bindings, operation) => operation(db))
    const { eventBus, subscriptions } = recordingEventBus()
    const descriptor = createCheckoutFinalizeSubscriberRuntime({ withDb, dispatchFinalize })
    await descriptor.register({ bindings: {}, container: createContainer(), eventBus })

    await subscriptions[0]?.handler(
      event("payment.completed", {
        bookingId: "booking_1",
        paymentSessionId: "session_1",
        paymentIntent: "card",
      }),
      { eventBus: scopedEventBus },
    )

    expect(descriptor).toMatchObject({
      id: COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID,
      eventType: "payment.completed",
    })
    expect(subscriptions[0]?.inline).toBe(true)
    expect(dispatchFinalize).toHaveBeenCalledWith(
      expect.objectContaining({
        db,
        eventBus: scopedEventBus,
        input: {
          bookingId: "booking_1",
          paymentSessionId: "session_1",
          paymentIntent: "card",
        },
        trigger: "payment.completed",
        correlationId: "session_1",
        tags: ["bookingId:booking_1", "paymentSessionId:session_1", "paymentIntent:card"],
      }),
    )
  })

  it("ignores unrelated payments and swallows dispatch failures", async () => {
    const dispatchFinalize = vi.fn(async () => {
      throw new Error("recorded workflow failure")
    })
    const withDb = vi.fn(async (_bindings, operation) => operation({} as PostgresJsDatabase))
    const { eventBus, subscriptions } = recordingEventBus()
    const descriptor = createCheckoutFinalizeSubscriberRuntime({ withDb, dispatchFinalize })
    await descriptor.register({ bindings: {}, container: createContainer(), eventBus })

    await subscriptions[0]?.handler(event("payment.completed", { bookingId: null }))
    expect(withDb).not.toHaveBeenCalled()

    await expect(
      subscriptions[0]?.handler(event("payment.completed", { bookingId: "booking_2" })),
    ).resolves.toBeUndefined()
    expect(dispatchFinalize).toHaveBeenCalledOnce()
  })
})
