import type {
  DeliveryLifecycleEvent,
  LifecycleItemRef,
  LifecycleListPage,
} from "@voyant-travel/channel-adapter-contracts"
import { definePort } from "@voyant-travel/core/project"

export interface NotificationDeliveryLifecycleSource {
  readonly id: string
  list(input: { cursor?: string; limit: number }): Promise<LifecycleListPage>
  fetch(ref: LifecycleItemRef): Promise<DeliveryLifecycleEvent>
  ack(ref: LifecycleItemRef): Promise<void>
}

export const notificationDeliveryLifecycleSourcePort =
  definePort<NotificationDeliveryLifecycleSource>({
    id: "notifications.delivery-lifecycle-source",
    test(source) {
      if (
        !source ||
        typeof source !== "object" ||
        typeof source.id !== "string" ||
        typeof source.list !== "function" ||
        typeof source.fetch !== "function" ||
        typeof source.ack !== "function"
      ) {
        throw new Error("notifications.delivery-lifecycle-source must implement list/fetch/ack")
      }
    },
  })
