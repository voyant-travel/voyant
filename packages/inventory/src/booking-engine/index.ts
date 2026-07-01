/**
 * `@voyant-travel/inventory/booking-engine` — owned-arm booking handler
 * for the Product vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6.
 */

export {
  type AvailabilityHoldBridge,
  type BookingCreateBridge,
  type BookingCreateBridgeInput,
  type BookingCreateBridgeResult,
  buildOwnedProductDraftShape,
  type CreateProductsBookingHandlerOptions,
  createProductsBookingHandler,
  type OwnedBillingContact,
  type ResolveOwnedBillingPerson,
} from "./handler.js"
