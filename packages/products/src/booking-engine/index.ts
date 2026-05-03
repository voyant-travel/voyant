/**
 * `@voyantjs/products/booking-engine` — owned-arm booking handler
 * for the products vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6.
 */

export {
  buildOwnedProductDraftShape,
  type CreateProductsBookingHandlerOptions,
  createProductsBookingHandler,
  type QuickCreateBridge,
  type QuickCreateBridgeInput,
  type QuickCreateBridgeResult,
} from "./handler.js"
