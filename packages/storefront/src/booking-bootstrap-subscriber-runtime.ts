import type { ModuleContainer, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  BOOKING_BOOTSTRAP_INTENT_EVENT,
  createBookingBootstrapIntentHandler,
} from "./booking-intents.js"
import type { StorefrontServiceOptions } from "./service.js"

export const STOREFRONT_BOOKING_BOOTSTRAP_SUBSCRIBER_ID =
  "@voyant-travel/storefront#subscriber.booking-bootstrap"
export const STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY = "storefront.booking-bootstrap.runtime"

export interface StorefrontBookingBootstrapRuntime {
  withDb<T>(bindings: unknown, operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
  serviceOptions?: StorefrontServiceOptions
}

export function registerStorefrontBookingBootstrapRuntime(
  container: ModuleContainer,
  runtime: StorefrontBookingBootstrapRuntime,
): void {
  container.register(STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY, runtime)
}

function resolveStorefrontBookingBootstrapRuntime(
  container: ModuleContainer,
): StorefrontBookingBootstrapRuntime {
  if (!container.has(STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY)) {
    throw new Error(
      `Storefront booking-bootstrap runtime is not registered at "${STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY}".`,
    )
  }
  return container.resolve<StorefrontBookingBootstrapRuntime>(
    STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY,
  )
}

/** Package-owned executable selected from the Storefront deployment manifest. */
export const storefrontBookingBootstrapSubscriber: SubscriberRuntimeDescriptor = {
  id: STOREFRONT_BOOKING_BOOTSTRAP_SUBSCRIBER_ID,
  eventType: BOOKING_BOOTSTRAP_INTENT_EVENT,
  register: ({ bindings, container, eventBus }) => {
    eventBus.subscribe(BOOKING_BOOTSTRAP_INTENT_EVENT, async (envelope) => {
      const runtime = resolveStorefrontBookingBootstrapRuntime(container)
      await runtime.withDb(bindings, async (db) => {
        await createBookingBootstrapIntentHandler({
          resolveDb: () => db,
          eventBus,
          env: bindings,
          serviceOptions: runtime.serviceOptions,
        })(envelope)
      })
    })
  },
}
