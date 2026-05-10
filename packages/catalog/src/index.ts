// Field-policy contract — the load-bearing schema decision.

// Public source-adapter contract.
export {
  ADAPTER_RATE_LIMITED,
  type AdapterCapabilities,
  AdapterRateLimitedError,
  CAPABILITY_NOT_SUPPORTED,
  type CancelRequest,
  type CancelResult,
  CapabilityNotSupportedError,
  type CatalogProjection,
  type ConnectionState,
  type DiscoveryCursor,
  type DiscoveryPage,
  type GetContentRequest,
  type GetContentResult,
  type LiveResolveRequest,
  type LiveResolveResult,
  type PushAvailabilityRequest,
  type PushAvailabilityResult,
  type PushBookingRequest,
  type PushBookingResult,
  type PushContentRequest,
  type PushContentResult,
  type ReserveRequest,
  type ReserveResult,
  type SourceAdapter,
  type SourceAdapterContext,
} from "./adapter/contract.js"
// BookingJourney HTTP contract — root export matches the Hono module pattern
// used by the vertical packages while keeping the ./booking-engine subpath.
export {
  type CatalogBookingAdapterContextInput,
  type CatalogBookingBookBody,
  type CatalogBookingBookTransformInput,
  type CatalogBookingCommittedEvent,
  type CatalogBookingContentScopeInput,
  type CatalogBookingDraftBody,
  type CatalogBookingDraftConsumedError,
  type CatalogBookingHoldPlaceBody,
  type CatalogBookingHoldReleaseBody,
  type CatalogBookingHoldTtlInput,
  type CatalogBookingProvenance,
  type CatalogBookingProvenanceInput,
  type CatalogBookingQuoteBody,
  type CatalogBookingQuoteTransformInput,
  type CatalogBookingRoutesOptions,
  createCatalogBookingHonoModule,
  createCatalogBookingRoutes,
} from "./booking-engine/routes.js"
export * from "./contract.js"
// Drift events.
export {
  blocksBookings,
  type CatalogDriftEvent,
  type ContentDriftEvent,
  type ContentDriftKind,
  type FieldDrift,
  maxDriftSeverity,
} from "./drift/events.js"
// Catalog event taxonomy + visibility-filtered payload helpers.
export {
  type BookingCancelledPayload,
  type BookingCommittedPayload,
  CATALOG_EVENT_CATEGORIES,
  CATALOG_EVENTS,
  type CatalogEventName,
  type CatalogEventPayloads,
  type EntityArchivedPayload,
  type EntityAvailabilityChangedPayload,
  type EntityCreatedPayload,
  type EntityDriftDetectedPayload,
  type EntityOverlayChangedPayload,
  type EntityPriceChangedPayload,
  type EntityReferenceMissingPayload,
  type EntityScope,
  type EntityUpdatedPayload,
  emitCatalogEvent,
  filterByVisibility,
  type ProvenanceFields,
  type SourceDisconnectedPayload,
  type SourceReconnectedPayload,
} from "./events/taxonomy.js"
// Search index — engine-agnostic contract + Typesense default + rerank helper.
export type {
  DocumentEmitter,
  FacetRequest,
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchFacetBucket,
  SearchFilter,
  SearchHit,
  SearchMode,
  SearchPagination,
  SearchRequest,
  SearchResults,
} from "./indexer/contract.js"
export {
  attachEmitter,
  buildCollectionSchema,
  buildSearchQuery,
  collectionName,
  createTypesenseIndexer,
  type TypesenseClient,
  type TypesenseCollectionSchema,
  type TypesenseFieldSchema,
  type TypesenseIndexerOptions,
  type TypesenseSearchHit,
  type TypesenseSearchQuery,
  type TypesenseSearchResponse,
} from "./indexer/typesense.js"
export {
  applyMerge,
  isVisibleTo,
  type OverlayLookup,
  type ResolvedFieldProvenance,
  type ResolvedView,
  type ResolverOverlay,
  type ResolverScope,
  resolveOverlay,
  variantFallbackChain,
} from "./overlay/resolver.js"
// Overlay store — editorial overrides keyed by (entity, field, locale, audience, market).
export {
  catalogOverlayTable,
  type InsertCatalogOverlay,
  OVERLAY_DEFAULT_SCOPE,
  type OverlayOrigin,
  overlayIdRef,
  type SelectCatalogOverlay,
} from "./overlay/schema.js"
// Provenance — every CatalogEntry carries this tuple.
export * from "./provenance.js"
// Sourced-entry store — durable provenance + projection capture (sourced-content §2.5).
export {
  catalogSourcedEntriesTable,
  type InsertCatalogSourcedEntry,
  type SelectCatalogSourcedEntry,
  type SourcedEntryStatus,
} from "./schema-sourced-entries.js"
export {
  type LivePriceFn,
  type LivePriceResult,
  type RerankedHit,
  type RerankOptions,
  type RerankParameters,
  rerank,
} from "./search/rerank.js"
export {
  type CatalogSearchBody,
  type CatalogSearchExecuteInput,
  type CatalogSearchFallbackInput,
  type CatalogSearchRoutesOptions,
  type CatalogSearchRoutesWithSurfaceOptions,
  type CatalogSearchRuntime,
  type CatalogSearchSurface,
  createCatalogSearchHonoModule,
  createCatalogSearchRoutes,
  mountCatalogSearchRoutes,
} from "./search/routes.js"
// Content-service primitives (sourced-content §3.4 / §3.5).
export {
  applyJsonPointerOverlay,
  type BuiltDriftPredicate,
  buildDriftInvalidationPredicate,
  type ContentLocaleMatchKind,
  type ContentLocaleResolution,
  type ContentOverlay,
  type CreateInvalidateOnDriftOptions,
  createInvalidateOnDrift,
  type InvalidateOnDrift,
  isStale,
  JsonPointerError,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
  parseJsonPointer,
  pickBestCachedLocale,
  type VerticalContentInvalidatableTable,
  withContentRefreshLock,
} from "./services/content-service.js"
export {
  buildIndexerDocument,
  createIndexerService,
  type DocumentBuilder,
  type IndexerService,
  type IndexerServiceOptions,
} from "./services/indexer-service.js"
// Runtime services — drizzle-bound entry points for verticals.
export {
  fetchOverlaysForEntity,
  listOverlaysByOrigin,
  type OverlayOriginFilter,
  resolveEntityView,
  resolveEntityViewWithOverlays,
  restoreOverlay,
  softDeleteOverlay,
  type WriteOverlayInput,
  writeOverlay,
} from "./services/overlay-service.js"
export {
  buildSnapshotInputFromView,
  type CaptureSnapshotInput,
  captureSnapshot,
  captureSnapshotGraph,
  fetchEntitySnapshot,
  fetchSnapshotsForBooking,
  viewToFrozenPayload,
  viewToOverlayState,
} from "./services/snapshot-service.js"
export {
  createReadProvenance,
  markSourcedEntryWithdrawn,
  type OwnedChecker,
  type ProvenanceReadResult,
  readSourcedEntry,
  type UpsertSourcedEntryInput,
  upsertSourcedEntry,
} from "./services/sourced-entry-service.js"
// Booking snapshot graph — frozen views captured at booking commit.
export {
  bookingCatalogSnapshotTable,
  type InsertBookingCatalogSnapshot,
  type PricingBasis,
  readPricingBasis,
  type SelectBookingCatalogSnapshot,
} from "./snapshot/schema.js"
