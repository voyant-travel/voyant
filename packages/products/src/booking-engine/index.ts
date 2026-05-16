/**
 * `@voyantjs/products/booking-engine` — owned-arm booking handler
 * for the products vertical.
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
} from "./handler.js"
