/**
 * `@voyantjs/catalog/booking-engine` — cross-vertical booking lifecycle
 * on top of the Phase 1 `SourceAdapter` contract.
 *
 * See `docs/architecture/catalog-booking-engine.md` for the full design.
 *
 * Lifecycle:
 *   1. `quoteEntity` → write to `catalog_quotes`, return short-lived quote.
 *   2. `bookEntity`  → call `adapter.reserve`, write `booking_catalog_snapshot`.
 *   3. `cancelEntity` → call `adapter.cancel`, snapshot stays for audit.
 *
 * Reads:
 *   - `listOrders` / `getOrderById` — surface snapshot rows cross-vertically.
 *
 * Adapters:
 *   - Templates wire a `SourceAdapterRegistry` at process start. The
 *     engine consults it on every dispatch.
 */

export {
  type BookEntityDeps,
  type BookEntityRequest,
  type BookEntityResult,
  type BookingPaymentIntent,
  bookEntity,
} from "./book.js"
export {
  type CancelEntityDeps,
  type CancelEntityRequest,
  type CancelEntityResult,
  cancelEntity,
} from "./cancel.js"
export {
  BookingEngineError,
  type BookingEngineErrorCode,
  NO_ADAPTER_REGISTERED,
  NoAdapterRegisteredError,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  QuoteExpiredError,
  QuoteMismatchError,
  RESERVE_FAILED,
  ReserveFailedError,
} from "./errors.js"
export {
  getOrderById,
  type ListOrdersQuery,
  type ListOrdersResult,
  listOrders,
} from "./orders.js"
export {
  DEFAULT_QUOTE_TTL_MS,
  type QuoteEntityDeps,
  type QuoteEntityRequest,
  type QuoteEntityResult,
  type QuoteScope,
  quoteEntity,
} from "./quote.js"
export {
  createSourceAdapterRegistry,
  type SourceAdapterRegistry,
} from "./registry.js"
export {
  catalogQuotesTable,
  type InsertCatalogQuote,
  type SelectCatalogQuote,
} from "./schema.js"
export {
  type SyncAdapterSummary,
  type SyncProgressEvent,
  type SyncSourcesOptions,
  type SyncSourcesSummary,
  syncSources,
} from "./sync.js"
