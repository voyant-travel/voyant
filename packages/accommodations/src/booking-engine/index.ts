/**
 * `@voyantjs/accommodations/booking-engine` — owned-arm booking
 * handler for the accommodation vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6.
 */

export {
  type AccommodationCommitBridge,
  type AccommodationCommitBridgeInput,
  type AccommodationCommitBridgeResult,
  type AccommodationContentLoader,
  type CreateAccommodationBookingHandlerOptions,
  createAccommodationBookingHandler,
} from "./handler.js"
