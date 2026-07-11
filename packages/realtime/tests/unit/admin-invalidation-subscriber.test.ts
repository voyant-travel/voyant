import type { EventEnvelope, EventHandler } from "@voyant-travel/core"
import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import {
  createAdminInvalidationSubscriberRuntime,
  registerAdminInvalidationPublicationPort,
} from "../../src/admin-invalidation-subscriber.js"

function envelope(name: string, data: { bookingId: string }): EventEnvelope {
  return { name, data, emittedAt: new Date().toISOString() }
}

function captureHandler() {
  const eventBus = createEventBus()
  let handler: EventHandler | undefined
  const subscribe = vi.spyOn(eventBus, "subscribe").mockImplementation((_event, candidate) => {
    handler = candidate as EventHandler
    return { unsubscribe: vi.fn() }
  })
  return { eventBus, subscribe, getHandler: () => handler }
}

describe("admin invalidation subscriber runtime", () => {
  it("registers exactly once per event bus as a deferred subscriber", async () => {
    const { eventBus, subscribe } = captureHandler()
    const descriptor = createAdminInvalidationSubscriberRuntime({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
      route: () => ["admin"],
    })
    const context = { bindings: {}, container: createContainer(), eventBus }

    await descriptor.register(context)
    await descriptor.register(context)

    expect({ id: descriptor.id, eventType: descriptor.eventType }).toEqual({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith("booking.confirmed", expect.any(Function), {
      inline: false,
    })
  })

  it("filters mismatched and explicitly ignored events before publication", async () => {
    const publish = vi.fn(async () => undefined)
    const route = vi.fn(() => undefined)
    const container = createContainer()
    registerAdminInvalidationPublicationPort(container, { publish, reportError: vi.fn() })
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createAdminInvalidationSubscriberRuntime({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
      route,
    })
    await descriptor.register({ bindings: {}, container, eventBus })

    await getHandler()?.(envelope("booking.cancelled", { bookingId: "booking_1" }))
    await getHandler()?.(envelope("booking.confirmed", { bookingId: "booking_1" }))

    expect(route).toHaveBeenCalledTimes(1)
    expect(publish).not.toHaveBeenCalled()
  })

  it("publishes each selected channel exactly once with the routed hint", async () => {
    const publish = vi.fn(async () => undefined)
    const container = createContainer()
    registerAdminInvalidationPublicationPort(container, { publish, reportError: vi.fn() })
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createAdminInvalidationSubscriberRuntime({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
      route: ({ bookingId }: { bookingId: string }) => ({
        channels: ["admin", `booking:${bookingId}`, "admin"],
        hint: { entity: "booking", id: bookingId },
      }),
    })
    await descriptor.register({ bindings: {}, container, eventBus })

    await getHandler()?.(envelope("booking.confirmed", { bookingId: "booking_1" }))

    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenCalledWith("admin", {
      event: "booking.confirmed",
      data: { event: "booking.confirmed", entity: "booking", id: "booking_1" },
    })
    expect(publish).toHaveBeenCalledWith("booking:booking_1", expect.any(Object))
  })

  it("reports publication errors without rejecting the deferred handler", async () => {
    const error = new Error("transport unavailable")
    const reportError = vi.fn()
    const container = createContainer()
    registerAdminInvalidationPublicationPort(container, {
      publish: vi.fn().mockRejectedValue(error),
      reportError,
    })
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createAdminInvalidationSubscriberRuntime({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
      route: () => ["admin"],
    })
    await descriptor.register({ bindings: {}, container, eventBus })

    await expect(
      getHandler()?.(envelope("booking.confirmed", { bookingId: "booking_1" })),
    ).resolves.toBeUndefined()
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(error, {
      event: "booking.confirmed",
      channel: "admin",
    })
  })

  it("stays inert until the publication port is available", async () => {
    const route = vi.fn(() => ["admin"])
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createAdminInvalidationSubscriberRuntime({
      id: "@voyant-travel/bookings#subscriber.admin-invalidation-confirmed",
      eventType: "booking.confirmed",
      route,
    })
    await descriptor.register({ bindings: {}, container: createContainer(), eventBus })

    await expect(
      getHandler()?.(envelope("booking.confirmed", { bookingId: "booking_1" })),
    ).resolves.toBeUndefined()
    expect(route).not.toHaveBeenCalled()
  })
})
