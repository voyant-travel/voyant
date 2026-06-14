import type { EventBus, EventSource } from "@voyant-travel/core"

export const CUSTOMER_SIGNAL_CREATED_EVENT = "customer.signal.created" as const

export type CustomerSignalCreatedIntake =
  | {
      surface: "storefront"
      type: "lead"
    }
  | {
      surface: "storefront"
      type: "newsletter"
      doubleOptIn: "not_configured" | "requested"
    }

export interface CustomerSignalCreatedEvent {
  id: string
  personId: string
  kind: "wishlist" | "notify" | "inquiry" | "request_offer" | "referral"
  source: "form" | "phone" | "admin" | "abandoned_cart" | "website" | "booking"
  status: "new" | "contacted" | "qualified" | "converted" | "lost" | "expired"
  productId?: string | null
  optionUnitId?: string | null
  sourceSubmissionId?: string | null
  intake?: CustomerSignalCreatedIntake
}

export async function emitCustomerSignalCreated(
  eventBus: EventBus | undefined,
  payload: CustomerSignalCreatedEvent,
  source: EventSource = "service",
): Promise<void> {
  if (!eventBus) return
  await eventBus.emit(CUSTOMER_SIGNAL_CREATED_EVENT, payload, {
    category: "domain",
    source,
  })
}
