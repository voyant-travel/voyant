// Field-policy contract — the load-bearing schema decision.

// Public source-adapter contract.
export {
  ADAPTER_RATE_LIMITED,
  type AdapterCapabilities,
  AdapterRateLimitedError,
  type AvailabilityBadge,
  type AvailabilityBadgeKind,
  type AvailabilityProjection,
  type AvailabilityRowKind,
  type AvailabilityStatus,
  type AvailabilityUnitPrecision,
  CAPABILITY_NOT_SUPPORTED,
  type CancelRequest,
  type CancelResult,
  CapabilityNotSupportedError,
  type CapabilitySupport,
  type CatalogProjection,
  type ConnectionState,
  type DiscoveryCursor,
  type DiscoveryPage,
  type GetContentRequest,
  type GetContentResult,
  type GetReservationRequest,
  type GetReservationResult,
  type ListReservationsPage,
  type ListReservationsQuery,
  type LiveResolveRequest,
  type LiveResolveResult,
  type PromotionApplicability,
  type PromotionApplicabilityConstraint,
  type PromotionApplicabilityConstraintKind,
  type PromotionApplicabilityEvaluation,
  type PromotionApplicabilityResolution,
  type PromotionDisplayFields,
  type PromotionMediaAsset,
  type PromotionMediaKind,
  type PromotionPriceEffect,
  type PromotionStackingSemantics,
  type ProviderCapabilityDeclaration,
  type ProviderCapabilityKey,
  type ProviderPromotion,
  type PushAvailabilityRequest,
  type PushAvailabilityResult,
  type PushBookingRequest,
  type PushBookingResult,
  type PushContentRequest,
  type PushContentResult,
  type ReservationStatus,
  type ReserveRequest,
  type ReserveResult,
  type SourceAdapter,
  type SourceAdapterContext,
  type SourceAdapterRequestScope,
} from "./adapter/contract.js"
export * from "./adapter/schemas.js"
// BookingJourney HTTP contract — root export matches the Hono module pattern
// used by the vertical packages while keeping the ./booking-engine subpath.
export {
  type CatalogBookingRouteModuleOptions,
  createCatalogBookingOrdersRoutes,
  mountCatalogBookingRoutes,
} from "./booking-engine/operator-routes.js"
export {
  type CatalogBookingAdapterContextInput,
  type CatalogBookingBatchQuoteBody,
  type CatalogBookingBatchQuoteSelection,
  type CatalogBookingBatchQuoteTransformInput,
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
// Embeddings + semantic search live in Catalog. Agent runtimes can wrap the
// HTTP APIs directly instead of depending on a separate catalog-MCP package.
export {
  chunkForBatch,
  EMBEDDING_BATCH_TOO_LARGE,
  EMBEDDING_INPUT_TOO_LONG,
  EMBEDDING_PROVIDER_ERROR,
  type EmbeddingProvider,
  type EmbeddingProviderCapabilities,
  EmbeddingProviderError,
} from "./embeddings/contract.js"
export {
  createGeminiEmbeddingProvider,
  GEMINI_MODELS,
  type GeminiEmbeddingModel,
  type GeminiEmbeddingProviderOptions,
  type GeminiTaskType,
} from "./embeddings/gemini.js"
export {
  type EmbeddingMigrationPlan,
  isActiveEmbeddingModel,
  planEmbeddingMigration,
  stampEmbeddingModelId,
  validateEmbeddingCompatibility,
} from "./embeddings/model-registry.js"
export {
  createOpenAIEmbeddingProvider,
  embedBatched,
  OPENAI_MODELS,
  type OpenAIEmbeddingModel,
  type OpenAIEmbeddingProviderOptions,
} from "./embeddings/openai.js"
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
  buildDefaultTypesenseQueryBy,
  buildDefaultTypesenseSearchFields,
  buildSearchQuery,
  collectionName,
  createTypesenseIndexer,
  type ImportFailureMode,
  type ImportFailureSummary,
  parseTypesenseImportResults,
  summarizeImportFailures,
  type TypesenseClient,
  type TypesenseCollectionSchema,
  type TypesenseFieldSchema,
  TypesenseImportError,
  type TypesenseImportRowResult,
  type TypesenseIndexerOptions,
  type TypesenseSearchHit,
  type TypesenseSearchQuery,
  type TypesenseSearchResponse,
} from "./indexer/typesense.js"
// Live offer/search routes (sourced packages + cruises). Connect-sdk /
// typesense / geo access is injected by the deployment via options.
export {
  type CatalogOffersAirportLabel,
  type CatalogOffersConnectClient,
  type CatalogOffersIndexFields,
  type CatalogOffersRouteModuleOptions,
  type CatalogOffersSearchDestination,
  createCatalogOffersAdminRoutes,
} from "./offers/operator-routes.js"
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
  type AvailabilityConnectionResult,
  type AvailabilityConnectionStatus,
  type FanOutAvailabilityResult,
  type FanOutAvailabilitySearchOptions,
  fanOutAvailabilitySearch,
} from "./search/availability-fan-out.js"
export {
  type FederatedSearchOptions,
  federateAudienceSearch,
  mergeAndDedupe,
} from "./search/federate.js"
export {
  createOwnedAvailabilitySearchHandlerRegistry,
  NoOwnedSearchHandlerRegisteredError,
  type OwnedAvailabilitySearchHandler,
  type OwnedAvailabilitySearchHandlerRegistry,
  type OwnedSearchContext,
} from "./search/owned-search-handler.js"
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
export {
  executeBYOVectorSearch,
  executeSemanticSearch,
  type SemanticSearchOptions,
} from "./search/semantic.js"
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
  fetchOverlaysForEntities,
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
  captureSnapshotGraphIdempotent,
  fetchEntitySnapshot,
  fetchSnapshotsForBooking,
  viewToFrozenPayload,
  viewToOverlayState,
} from "./services/snapshot-service.js"
export {
  createReadProvenance,
  markMissingSourcedEntriesWithdrawn,
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
export {
  type CatalogEntryResult,
  type CatalogEntryServiceInput,
  type CatalogSearchArgs,
  type CatalogSearchServiceInput,
  type CatalogToolContext,
  type CatalogToolServices,
  catalogTools,
  type GetCatalogEntryArgs,
  getCatalogEntryTool,
  searchCatalogTool,
} from "./tools.js"
