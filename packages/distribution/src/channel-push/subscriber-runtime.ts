import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"

import { createChannelPushSubscribers } from "./subscriber.js"
import { CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, type ChannelPushDeps } from "./types.js"

const BOOKING_CONFIRMED_SUBSCRIBER_ID =
  "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed"
const AVAILABILITY_CHANGED_SUBSCRIBER_ID =
  "@voyant-travel/distribution#subscriber.channel-push-availability-changed"
const CONTENT_CHANGED_SUBSCRIBER_ID =
  "@voyant-travel/distribution#subscriber.channel-push-content-changed"

function defineChannelPushSubscriberRuntime(
  id: string,
  eventType: string,
): SubscriberRuntimeDescriptor {
  return {
    id,
    eventType,
    register: ({ container, eventBus }) => {
      const subscriber = createChannelPushSubscribers({
        resolveDeps: () =>
          container.has(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
            ? container.resolve<ChannelPushDeps>(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
            : undefined,
      }).find((candidate) => candidate.event === eventType)

      if (!subscriber) {
        throw new Error(`Channel-push subscriber runtime is missing event "${eventType}".`)
      }
      eventBus.subscribe(subscriber.event, subscriber.handler, {
        inline: subscriber.inline ?? false,
      })
    },
  }
}

export const channelPushBookingConfirmedSubscriber = defineChannelPushSubscriberRuntime(
  BOOKING_CONFIRMED_SUBSCRIBER_ID,
  "booking.confirmed",
)

export const channelPushAvailabilityChangedSubscriber = defineChannelPushSubscriberRuntime(
  AVAILABILITY_CHANGED_SUBSCRIBER_ID,
  "availability.slot.changed",
)

export const channelPushContentChangedSubscriber = defineChannelPushSubscriberRuntime(
  CONTENT_CHANGED_SUBSCRIBER_ID,
  "product.content.changed",
)
