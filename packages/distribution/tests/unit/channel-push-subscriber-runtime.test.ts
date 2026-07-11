import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import {
  channelPushAvailabilityChangedSubscriber,
  channelPushBookingConfirmedSubscriber,
  channelPushContentChangedSubscriber,
} from "../../src/channel-push/subscriber-runtime.js"

describe("channel-push graph subscriber runtime", () => {
  it("registers each package-owned descriptor against its declared event", async () => {
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const descriptors = [
      channelPushBookingConfirmedSubscriber,
      channelPushAvailabilityChangedSubscriber,
      channelPushContentChangedSubscriber,
    ]

    for (const descriptor of descriptors) {
      await descriptor.register({ bindings: {}, container: createContainer(), eventBus })
    }

    expect(descriptors.map(({ id, eventType }) => ({ id, eventType }))).toEqual([
      {
        id: "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
        eventType: "booking.confirmed",
      },
      {
        id: "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
        eventType: "availability.slot.changed",
      },
      {
        id: "@voyant-travel/distribution#subscriber.channel-push-content-changed",
        eventType: "product.content.changed",
      },
    ])
    expect(subscribe.mock.calls.map(([event]) => event)).toEqual(
      descriptors.map(({ eventType }) => eventType),
    )
  })
})
