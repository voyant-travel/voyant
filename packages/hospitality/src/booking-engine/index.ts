/**
 * `@voyantjs/hospitality/booking-engine` — owned-arm booking
 * handler for the hospitality vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6.
 */

export {
  type CreateHospitalityBookingHandlerOptions,
  createHospitalityBookingHandler,
  type HospitalityCommitBridge,
  type HospitalityCommitBridgeInput,
  type HospitalityCommitBridgeResult,
  type HospitalityContentLoader,
} from "./handler.js"
