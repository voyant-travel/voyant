import { createEventBus } from "@voyant-travel/core"
import { defineGraphRuntimeFactory, definePort } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"

import { composeVoyantGraphRuntime } from "./runtime-composition.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

describe("subscriber runtime port composition", () => {
  it("resolves subscriber graph factories through declared runtime ports", async () => {
    const subscriberPort = definePort<{ handler: () => Promise<void> }>({
      id: "alerts.subscriber-runtime",
      test(provider) {
        if (typeof provider.handler !== "function") throw new Error("handler required")
      },
    })
    const subscriberFactory = defineGraphRuntimeFactory(async ({ getPort }) => {
      const provider = await getPort(subscriberPort)
      return {
        id: "@acme/alerts#subscriber.booking-confirmed",
        eventType: "booking.confirmed",
        register: ({ eventBus }: { eventBus: ReturnType<typeof createEventBus> }) => {
          eventBus.subscribe("booking.confirmed", provider.handler)
        },
      }
    })
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:subscriber-factory",
      entries: { "@acme/alerts/subscribers": async () => ({ subscriberFactory }) },
      modules: [
        {
          id: "@acme/alerts",
          kind: "module",
          packageName: "@acme/alerts",
          order: 0,
          runtimePorts: [subscriberPort.id],
          references: [
            {
              id: "alerts-subscriber",
              unitId: "@acme/alerts",
              facet: "subscribers.runtime",
              entityId: "@acme/alerts#subscriber.booking-confirmed",
              runtime: { entry: "./subscribers", export: "subscriberFactory" },
              importEntry: "@acme/alerts/subscribers",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })
    const handler = vi.fn(async () => {})
    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      ports: { [subscriberPort.id]: { handler } },
    })
    const eventBus = createEventBus()

    await composition.modules[0]?.module.bootstrap?.({
      bindings: {},
      container: {} as never,
      eventBus,
    })
    await eventBus.emit("booking.confirmed", {})

    expect(handler).toHaveBeenCalledOnce()
    await expect(composeVoyantGraphRuntime({ runtime, capabilities: {} })).rejects.toThrow(
      /requires runtime port "alerts\.subscriber-runtime"/,
    )
  })
})
