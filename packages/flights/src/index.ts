// Flight contract types — offers, orders, segments, search, booking.

// FlightConnectorAdapter contract.
export {
  type AdapterLogger,
  CAPABILITY_NOT_SUPPORTED,
  type FlightAdapterCapabilities,
  type FlightAdapterContext,
  type FlightAdapterEnvironment,
  type FlightBookResponse,
  type FlightCancelReason,
  type FlightCancelResponse,
  FlightCapabilityNotSupportedError,
  type FlightConnectorAdapter,
  type FlightGetOrderResponse,
  type FlightPriceRequest,
  type FlightPriceResponse,
  type FlightSearchResponse,
  requireCapability,
} from "./contract/adapter.js"
export * from "./contract/types.js"
export {
  type ConnectionResult,
  type ConnectionSearchStatus,
  type FanOutFlightSearchOptions,
  type FanOutFlightSearchResult,
  fanOutFlightSearch,
  type MergedFlightOffer,
} from "./orchestration/fan-out.js"
// Orchestration — fingerprinting + multi-connection fan-out.
export { itineraryFingerprint } from "./orchestration/fingerprint.js"
// ReferenceDataProvider — swappable provider for global reference data.
export {
  type Aircraft,
  type Airline,
  type Airport,
  dedupeCodes,
  type ReferenceDataCapabilities,
  type ReferenceDataProvider,
} from "./reference/contract.js"
export {
  createLocalPostgresReferenceProvider,
  type LocalPostgresReferenceProviderOptions,
  referenceAircraft,
  referenceAirlines,
  referenceAirports,
} from "./reference/local-postgres.js"
export {
  createStaticBundleReferenceProvider,
  type StaticBundleProviderOptions,
  type StaticBundleReferenceData,
} from "./reference/static-bundle.js"
// Snapshot capture for booking-time integration with the catalog plane.
export {
  type BuildFlightSnapshotInputOptions,
  buildFlightSnapshotInput,
} from "./snapshot.js"
