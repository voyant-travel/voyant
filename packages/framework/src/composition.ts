/**
 * The standard Voyant runtime composition registry — the package-owned half of
 * `OPERATOR_RUNTIME_MANIFEST`'s factories.
 *
 * agent-quality: file-size exception -- this is the framework's single
 * composition source of truth (the FrameworkProviders contract + one factory
 * entry per standard module/extension). Keeping the provider interface + the
 * registry in one file is intentional; the length scales with the standard
 * module count, not with logic complexity — mirroring the deployment's
 * `composition.ts` rationale.
 *
 * Workstream B of the consolidated-deployments RFC relocates the deployment's
 * `operatorComposition` registry here, one classified-as-standard family group
 * at a time (see `operator-registry-classification.md`). A deployment spreads
 * this into its own registry:
 *
 *     export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
 *       modules:    { ...frameworkComposition.modules,    ...deploymentLocal },
 *       extensions: { ...frameworkComposition.extensions, ...deploymentLocal },
 *     }
 *
 * so `composeFromManifest` always sees one complete registry while the
 * deployment object shrinks PR by PR.
 *
 * The factories read only the framework-owned {@link FrameworkProviders} surface
 * off `ctx.capabilities` — never a deployment file, never a baked provider
 * choice (Netopia et al. stay injected). Because `OperatorCapabilities extends
 * FrameworkProviders` and factory params are contravariant, a
 * `ModuleFactory<FrameworkProviders>` slots cleanly into the deployment's wider
 * `CompositionRegistry<OperatorCapabilities>`.
 *
 * Provider field types are anchored to the package option types they feed
 * (`NonNullable<XOptions["field"]>`) or to a package service (`typeof
 * relationshipsService`), so they can't drift from the contracts the factories
 * pass them into.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import { accommodationsHonoModule } from "@voyant-travel/accommodations"
import { enrichStayBookingOverviewItems } from "@voyant-travel/accommodations/booking-overview-enricher"
import { actionLedgerHonoModule } from "@voyant-travel/action-ledger"
import {
  type BookingsHonoModuleOptions,
  bookingsSupplierExtension,
  createBookingsHonoModule,
} from "@voyant-travel/bookings"
import { bookingsExtrasRoutes } from "@voyant-travel/bookings/extras"
import {
  type BookingRequirementsHonoModuleOptions,
  createBookingRequirementsHonoModule,
} from "@voyant-travel/bookings/requirements"
import {
  type CatalogSearchRoutesOptions,
  createCatalogSearchHonoModule,
  type EmbeddingProvider,
  executeSemanticSearch,
} from "@voyant-travel/catalog"
import {
  createCommerceHonoModules,
  createCommerceStorefrontOfferResolvers,
} from "@voyant-travel/commerce"
import {
  distributionBookingExtension,
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "@voyant-travel/distribution"
import {
  bookingsCreateExtension,
  createBookingTaxHonoExtension,
  createFinanceHonoModule,
  type FinanceHonoModuleOptions,
} from "@voyant-travel/finance"
import type { CheckoutNotificationDelivery } from "@voyant-travel/finance/checkout"
import type { CheckoutReminderRunRecord } from "@voyant-travel/finance/checkout-validation"
import {
  createPublicDocumentDeliveryHonoModule,
  type LazyRoutesLoader,
  openApiValidationHook,
} from "@voyant-travel/hono"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import { identityHonoModule } from "@voyant-travel/identity"
import { inventoryBookingExtension, inventoryHonoModule } from "@voyant-travel/inventory"
import { inventoryAuthoringExtension } from "@voyant-travel/inventory/authoring/extension"
import { inventoryExtrasRoutes } from "@voyant-travel/inventory/extras"
import {
  CONTRACT_DOCUMENT_ROUTE_PATHS,
  type CreateLegalHonoModuleOptions,
  createLegalHonoModule,
} from "@voyant-travel/legal"
import {
  type CreateNotificationsHonoModuleOptions,
  createDefaultBookingDocumentAttachment,
  createNotificationService,
  createNotificationsHonoModule,
  notificationsService,
} from "@voyant-travel/notifications"
import { operationsHonoModule } from "@voyant-travel/operations"
import {
  resolveBookingTaxSettings,
  updateBookingTaxSettings,
} from "@voyant-travel/operator-settings"
import { createOperatorSettingsHonoModule } from "@voyant-travel/operator-settings/hono-module"
import { createQuotesHonoModule, quotesBookingExtension } from "@voyant-travel/quotes"
import {
  createRelationshipsHonoModule,
  type relationshipsService,
} from "@voyant-travel/relationships"
import {
  createStorefrontHonoModule,
  type StorefrontIntakePersistence,
} from "@voyant-travel/storefront"
import { createCustomerPortalHonoModule } from "@voyant-travel/storefront/customer-portal"
import {
  createStorefrontVerificationHonoModule,
  type StorefrontVerificationRoutesOptions,
} from "@voyant-travel/storefront/verification"
import { createTripsHonoModule, type TripsRoutesOptionsProvider } from "@voyant-travel/trips"

/**
 * Combined "extras" surface — inventory + bookings package extras routes mounted
 * on one module. Pure composition of package route sets (no providers); the
 * deployment used to build this inline.
 *
 * An `OpenAPIHono` (not a plain `Hono`) so the bookings extras `.openapi()`
 * routes' registry propagates up to the composed root and into the framework
 * OpenAPI spec (voyant#2114). The shared `openApiValidationHook` keeps any
 * validation failures on the framework's `invalid_request` contract.
 */
const extrasCombinedRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })
  .route("/", inventoryExtrasRoutes)
  .route("/", bookingsExtrasRoutes)

const extrasHonoModule = {
  module: { name: "extras" },
  adminRoutes: extrasCombinedRoutes,
} satisfies HonoModule

type FrameworkRelationshipsService = Pick<
  typeof relationshipsService,
  "getPersonById" | "getOrganizationById" | "loadPersonTravelSnapshot" | "upsertPersonFromContact"
>

// Stable absolute route matchers for the lazy `operator/*` standard families
// (Tier 4). The framework owns the URL contract; the deployment injects only
// the `load` closure that wires its providers into the route bundle.
const CATALOG_BOOKING_ROUTE_PATHS = [
  "/v1/admin/catalog/quote",
  "/v1/admin/catalog/quotes/batch",
  "/v1/admin/catalog/book",
  "/v1/admin/catalog/drafts/:id",
  "/v1/admin/catalog/holds/place",
  "/v1/admin/catalog/holds/release",
  "/v1/admin/catalog/slots",
  "/v1/admin/catalog/orders",
  "/v1/admin/catalog/orders/:id",
  "/v1/admin/catalog/orders/:id/cancel",
  "/v1/admin/bookings/:id/catalog-snapshot",
  "/v1/public/catalog/quote",
  "/v1/public/catalog/quotes/batch",
  "/v1/public/catalog/book",
  "/v1/public/catalog/drafts/:id",
  "/v1/public/catalog/holds/place",
  "/v1/public/catalog/holds/release",
  "/v1/public/catalog/slots",
] as const

// The transactional subset of the catalog booking engine (ADR-0008): quote /
// book / holds / orders reach bookings' reserve/release transactions through the
// owned-product adapter. Search/browse (slots), draft reads, and the booking
// catalog-snapshot read stay on the cheap default client. Prefix matches, so
// `/holds` covers `/holds/place` + `/holds/release` and `/orders` covers
// `/orders/:id[/cancel]`. Declared here (the framework owns these route
// matchers) so deployments don't hand-list them in `dbTransactionalPaths`.
const CATALOG_BOOKING_TRANSACTIONAL_PATHS = [
  "/v1/admin/catalog/quote",
  "/v1/admin/catalog/quotes/batch",
  "/v1/admin/catalog/book",
  "/v1/admin/catalog/holds",
  "/v1/admin/catalog/orders",
  "/v1/public/catalog/quote",
  "/v1/public/catalog/quotes/batch",
  "/v1/public/catalog/book",
  "/v1/public/catalog/holds",
] as const

const CATALOG_CONTENT_ROUTE_PATHS = [
  "/v1/admin/products/:id/content",
  "/v1/public/products/:id/content",
  "/v1/admin/cruises/:id/content",
  "/v1/public/cruises/:id/content",
  "/v1/admin/cruises/:id/sailings/:sailingExternalId/pricing",
  "/v1/public/cruises/:id/sailings/:sailingExternalId/pricing",
  "/v1/admin/accommodations/:id/content",
  "/v1/public/accommodations/:id/content",
] as const

const MEDIA_ROUTE_PATHS = [
  "/v1/admin/products/:id/brochure/generate",
  "/v1/admin/uploads",
  "/v1/admin/uploads/video",
  "/v1/admin/media/*",
] as const

const PAYMENT_LINK_ROUTE_PATHS = [
  "/v1/public/payment-link-config",
  "/v1/public/payment-link/:sessionId/retry",
  "/v1/public/payment-link/resolve",
  "/v1/public/payment-link/:sessionId/start-card",
  "/v1/public/payment-link/:sessionId/trip-summary",
  "/v1/public/payment-link/:sessionId/booking-summary",
  "/v1/public/bookings/:bookingId/checkout-status",
] as const

// Finance checkout adapters — map notifications-service shapes into the
// finance checkout DTOs the module expects.
type NotificationDeliveryLike = {
  id: string
  templateSlug: string | null
  channel: "email" | "sms"
  provider: string
  status: "pending" | "sent" | "failed" | "cancelled"
  toAddress: string
  subject: string | null
  sentAt: Date | string | null
  failedAt: Date | string | null
  errorMessage: string | null
}

function optionalDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toCheckoutNotificationDelivery(
  delivery: NotificationDeliveryLike | null,
): CheckoutNotificationDelivery | null {
  if (!delivery) return null
  return {
    id: delivery.id,
    templateSlug: delivery.templateSlug,
    channel: delivery.channel,
    provider: delivery.provider,
    status: delivery.status,
    toAddress: delivery.toAddress,
    subject: delivery.subject,
    sentAt: optionalDateTime(delivery.sentAt),
    failedAt: optionalDateTime(delivery.failedAt),
    errorMessage: delivery.errorMessage,
  }
}

type NotificationReminderRunLike = Awaited<
  ReturnType<typeof notificationsService.listReminderRuns>
>["data"][number]

function toCheckoutReminderRun(run: NotificationReminderRunLike): CheckoutReminderRunRecord {
  return {
    id: run.id,
    reminderRuleId: run.reminderRuleId,
    reminderRuleSlug: run.reminderRule.slug,
    reminderRuleName: run.reminderRule.name,
    targetType: run.targetType,
    targetId: run.targetId,
    bookingId: run.links.bookingId,
    paymentSessionId: run.links.paymentSessionId,
    notificationDeliveryId: run.links.notificationDeliveryId,
    status: run.status,
    deliveryStatus: run.delivery?.status ?? null,
    channel: run.delivery?.channel ?? run.reminderRule.channel,
    provider: run.delivery?.provider ?? run.reminderRule.provider ?? null,
    recipient: run.recipient,
    scheduledFor: run.scheduledFor,
    processedAt: run.processedAt,
    errorMessage: run.errorMessage,
    relativeDaysFromDueDate: null,
    createdAt: run.createdAt,
  }
}

/**
 * The injected, deployment-specific provider surface the framework's standard
 * factories read off the composition `ctx.capabilities`. It is the typed,
 * framework-owned subset of the deployment's capability container — the
 * deployment's `OperatorCapabilities extends FrameworkProviders`, so the
 * deployment supplies these (plus its own extras) and the framework factories
 * see only what they're entitled to.
 *
 * Each field is typed by the package option type it feeds (drift-proof) or by a
 * package service. It grows as more capability-shaped factories relocate.
 */
export interface FrameworkProviders {
  /** Relationships service — bookings reads person/snapshot helpers off it. */
  relationshipsService: FrameworkRelationshipsService
  /** Closes a booking's terminal payment schedules (bookings module option). */
  closePaymentSchedulesForBooking: NonNullable<
    BookingsHonoModuleOptions["closePaymentSchedulesForBooking"]
  >
  /** Records cancellation settlement guidance for paid bookings. */
  recordCancellationFinancialSettlement?: BookingsHonoModuleOptions["recordCancellationFinancialSettlement"]
  /**
   * Deployment custom-field registry (see `@voyant-travel/core/custom-fields`),
   * injected into entities that validate `customFields` on write. Optional — a
   * deployment that declares no custom fields omits it.
   */
  customFields?: BookingsHonoModuleOptions["customFields"]
  /** Resolves a stored document's download URL (bindings + storage key). */
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) => Promise<string | null>
  /** Resolves the notification providers for the verification challenge. */
  resolveNotificationProviders: NonNullable<StorefrontVerificationRoutesOptions["resolveProviders"]>
  /** Deployment-built trips route options (connector, payment wiring, ...). */
  createTripsRoutesOptions: TripsRoutesOptionsProvider
  /** Out-of-request db handle for legal's booking.confirmed subscriber. */
  resolveDb: NonNullable<CreateLegalHonoModuleOptions["resolveDb"]>
  /** Per-request document storage backend (legal contract documents). */
  createOperatorDocumentStorage: NonNullable<CreateLegalHonoModuleOptions["resolveDocumentStorage"]>
  /** Resolves the contract-document (PDF) generator. */
  resolveContractDocumentGenerator: NonNullable<
    CreateLegalHonoModuleOptions["resolveDocumentGenerator"]
  >
  /** Resolves the booking PII service for contract rendering. */
  createBookingPiiService: NonNullable<CreateLegalHonoModuleOptions["resolveBookingPiiService"]>
  /** Opt-in auto-generate-contract-on-confirmed options. */
  autoGenerateContractOnConfirmed: NonNullable<
    CreateLegalHonoModuleOptions["autoGenerateContractOnConfirmed"]
  >
  /** Resolves the public checkout base URL (notification deep links). */
  resolvePublicCheckoutBaseUrl: NonNullable<
    CreateNotificationsHonoModuleOptions["resolvePublicCheckoutBaseUrl"]
  >
  /** Reads a stored document's content as base64 (notification attachments). */
  readDocumentContentBase64: (bindings: unknown, storageKey: string) => Promise<string | null>
  /** Resolves a product snapshot for the public booking-requirements routes. */
  resolveBookingRequirementsProductSnapshot: NonNullable<
    NonNullable<BookingRequirementsHonoModuleOptions["publicRoutes"]>["resolveProductSnapshot"]
  >
  /** Resolves the per-request catalog search runtime (indexer/embeddings/scope). */
  resolveCatalogRuntime: CatalogSearchRoutesOptions["resolveRuntime"]
  /** Storefront intake persistence (relationships-backed). */
  storefrontIntakePersistence: StorefrontIntakePersistence
  /** Resolves the invoice exchange-rate resolver (FX snapshots). */
  createInvoiceExchangeRateResolver: NonNullable<
    FinanceHonoModuleOptions["resolveInvoiceExchangeRateResolver"]
  >
  /** Resolves the invoice settlement pollers (external sync). */
  createInvoiceSettlementPollers: NonNullable<
    FinanceHonoModuleOptions["resolveInvoiceSettlementPollers"]
  >
  /** Resolves bank-transfer payment details for the checkout. */
  resolveBankTransferDetails: NonNullable<FinanceHonoModuleOptions["resolveBankTransferDetails"]>
  /**
   * Deployment checkout policy overrides. Optional: omitted deployments keep
   * the finance module defaults.
   */
  financeCheckoutPolicy?: FinanceHonoModuleOptions["policy"]
  /**
   * Deployment invoice payment-schedule line description format override.
   * Optional: omitted deployments keep the finance module default.
   */
  financePaymentScheduleLineDescriptionFormat?: FinanceHonoModuleOptions["paymentScheduleLineDescriptionFormat"]
  /** Configured pay-by-link starters, keyed by payment provider id. */
  resolvePaymentStarters?: import("@voyant-travel/finance").FinanceHonoModuleOptions["resolvePaymentStarters"]
  /** Configured hosted card-payment starter for checkout/payment-link surfaces. */
  resolveCardPaymentStarter?: (
    bindings: unknown,
  ) => import("@voyant-travel/finance/card-payment").CardPaymentStarter | null
  /**
   * Booking-confirmed notification auto-dispatch policy. Optional: omitted
   * deployments keep the standard booking-confirmation auto-send.
   */
  notificationsAutoConfirmAndDispatch?: CreateNotificationsHonoModuleOptions["autoConfirmAndDispatch"]
  /** Builds the distribution channel-push extension (deployment booking-engine wiring). */
  createChannelPushExtension: () => HonoExtension
  // Lazy route-bundle loaders for the `operator/*` standard families (Tier 4).
  // Each wires the deployment's providers into a package-owned route bundle and
  // returns the sub-app; the framework owns the manifest entry + path matchers.
  /** Loads the flights admin routes (connector + payment wiring). */
  loadFlightAdminRoutes: LazyRoutesLoader
  /** Loads the trips/MCP admin routes (tool context + trips service). */
  loadMcpAdminRoutes: LazyRoutesLoader
  /** Loads the catalog booking-engine routes (connect client, source registry). */
  loadCatalogBookingRoutes: LazyRoutesLoader
  /** Loads the catalog content routes (connect client, Typesense). */
  loadCatalogContentRoutes: LazyRoutesLoader
  /** Loads the media routes (R2 storage, video signer, brochure printer). */
  loadMediaRoutes: LazyRoutesLoader
  /** Loads the storefront payment-link routes (card seam, bank transfer). */
  loadPaymentLinkRoutes: LazyRoutesLoader
  /** Loads the legal contract-document routes (PDF engine, doc storage, PII). */
  loadContractDocumentRoutes: LazyRoutesLoader
  // Lazy `operator/*` standard extensions (Tier 4). Builders/loaders injected;
  // the framework owns the `extension` metadata + publicPath.
  /** Builds the bookings deposit/balance schedule extension. */
  createBookingScheduleExtension: () => HonoExtension
  /** Builds the trips/quotes version-snapshot extension. */
  createQuoteVersionSnapshotExtension: () => HonoExtension
  /** Loads the bookings tax-line rebuild maintenance route. */
  loadBookingMaintenanceRoutes: LazyRoutesLoader
  /** Loads the action-ledger drift health route. */
  loadActionLedgerHealthRoutes: LazyRoutesLoader
  /** Loads the quote-version proposal admin routes (send). */
  loadProposalAdminRoutes: LazyRoutesLoader
  /** Loads the quote-version proposal public routes (accept/decline). */
  loadProposalPublicRoutes: LazyRoutesLoader
  /** Loads the catalog admin offer/search routes. */
  loadCatalogOffersRoutes: LazyRoutesLoader
  /** Loads the catalog public checkout routes. */
  loadCatalogCheckoutRoutes: LazyRoutesLoader
}

/**
 * Tag a module's anonymous-access surface (ADR-0008) without disturbing the rest
 * of its definition: `true` = whole public mount is reachable without a session;
 * a string array = specific sub-paths relative to the public mount. The framework
 * assembles the global allow-list from these, so the "reachable-without-auth"
 * decision for a standard route lives here next to its mount, not in a hand-kept
 * `publicPaths` list in every deployment.
 */
const withAnonymous = (module: HonoModule, anonymous: HonoModule["anonymous"]): HonoModule => ({
  ...module,
  anonymous,
})

/**
 * Standard module/extension factories owned by the framework. Keyed by the same
 * manifest specifiers as `FRAMEWORK_RUNTIME_MANIFEST`; a deployment spreads this
 * into its registry (see file header).
 *
 * - Tier 1: the pure singleton modules — no providers, no deployment imports.
 * - Tier 2: capability-shaped `@voyant-travel/*` modules — read injected
 *   providers off `ctx.capabilities`.
 */
export const frameworkComposition: CompositionRegistry<FrameworkProviders> = {
  modules: {
    // Tier 1 — pure singletons.
    "@voyant-travel/action-ledger": () => actionLedgerHonoModule,
    "@voyant-travel/relationships": ({ capabilities }) =>
      createRelationshipsHonoModule({ customFields: capabilities.customFields }),
    "@voyant-travel/quotes": ({ capabilities }) =>
      createQuotesHonoModule({
        resolveParticipantPersonById: async (db, personId) =>
          (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
      }),
    "@voyant-travel/accommodations": () => accommodationsHonoModule,
    "@voyant-travel/operations": () => operationsHonoModule,
    "@voyant-travel/identity": () => identityHonoModule,
    "@voyant-travel/distribution": () => [
      externalRefsHonoModule,
      distributionHonoModule,
      suppliersHonoModule,
    ],
    "@voyant-travel/commerce": () => createCommerceHonoModules(),
    "@voyant-travel/inventory": () => inventoryHonoModule,
    "@voyant-travel/inventory/extras": () => extrasHonoModule,
    "@voyant-travel/bookings/requirements": ({ capabilities }) =>
      createBookingRequirementsHonoModule({
        publicRoutes: {
          resolveProductSnapshot: capabilities.resolveBookingRequirementsProductSnapshot,
        },
      }),
    // Tier 2 — capability-shaped modules (providers injected via ctx).
    "@voyant-travel/catalog": ({ capabilities }) =>
      // The storefront browse/search + detail surface is auth-less
      // (booking-journey-architecture §10 Phase B).
      withAnonymous(
        createCatalogSearchHonoModule({
          resolveRuntime: capabilities.resolveCatalogRuntime,
          executeSearch: ({ adapter, embeddings, slice, request }) =>
            executeSemanticSearch({
              adapter,
              embeddings: embeddings as EmbeddingProvider | undefined,
              slice,
              request,
            }),
        }),
        true,
      ),
    "@voyant-travel/storefront": ({ capabilities }) =>
      // Storefront mounts at the public root (`publicPath: "/"`) and declares
      // its own anonymous public paths next to the routes it owns.
      createStorefrontHonoModule({
        offers: createCommerceStorefrontOfferResolvers(),
        // Async booking-bootstrap intents (queued write pipeline, RFC
        // voyant#1687 §3.2) — the handler runs on the app bus with outbox-grade
        // retries; the */2min cron sweeps stale intents.
        bookingIntents: { resolveDb: capabilities.resolveDb },
        intake: { persistence: capabilities.storefrontIntakePersistence },
      }),
    "@voyant-travel/finance": ({ capabilities }) =>
      // The emailed-link finance pages (payment-session landing, collections,
      // accountant share portal, booking summary) are reached without a session
      // — the token/id in the path is the credential. Only these sub-paths.
      withAnonymous(
        createFinanceHonoModule({
          resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
            capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
          resolveInvoiceExchangeRateResolver: capabilities.createInvoiceExchangeRateResolver,
          resolveInvoiceSettlementPollers: capabilities.createInvoiceSettlementPollers,
          invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
            bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
          resolveNotificationDispatcher: (bindings) => {
            const providers = capabilities.resolveNotificationProviders(bindings)
            if (providers.length === 0) return null

            const dispatcher = createNotificationService(providers)
            return {
              sendInvoiceNotification: async (db, invoiceId, input) =>
                toCheckoutNotificationDelivery(
                  await notificationsService.sendInvoiceNotification(
                    db,
                    dispatcher,
                    invoiceId,
                    input,
                  ),
                ),
              sendPaymentSessionNotification: async (db, paymentSessionId, input) =>
                toCheckoutNotificationDelivery(
                  await notificationsService.sendPaymentSessionNotification(
                    db,
                    dispatcher,
                    paymentSessionId,
                    input,
                  ),
                ),
            }
          },
          resolvePaymentStarters: capabilities.resolvePaymentStarters,
          policy: capabilities.financeCheckoutPolicy,
          paymentScheduleLineDescriptionFormat:
            capabilities.financePaymentScheduleLineDescriptionFormat,
          resolveBookingTaxSettings,
          updateBookingTaxSettings,
          resolveBankTransferDetails: capabilities.resolveBankTransferDetails,
          resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
          listBookingReminderRuns: async (db, bookingId, query) => {
            const result = await notificationsService.listReminderRuns(db, {
              bookingId,
              status: query.status,
              limit: query.limit,
              offset: query.offset,
            })
            return {
              data: result.data.map(toCheckoutReminderRun),
              total: result.total,
              limit: result.limit,
              offset: result.offset,
            }
          },
        }),
        ["/bookings", "/collections", "/payment-sessions", "/accountant", "/vouchers"],
      ),
    "@voyant-travel/bookings": ({ capabilities }) =>
      // Storefront post-payment status poll: the booking id is a TypeID in the
      // redirect URL and the response exposes only non-PII state.
      withAnonymous(
        createBookingsHonoModule({
          resolveTravelSnapshot: (db, personId, { kms }) =>
            capabilities.relationshipsService.loadPersonTravelSnapshot(db, personId, { kms }),
          resolveBillingPerson: async (db, contact, ctx) => {
            const person = await capabilities.relationshipsService.upsertPersonFromContact(
              db,
              contact,
              {
                source: ctx.source,
                sourceRef: ctx.sourceRef,
              },
            )
            return person?.id ?? null
          },
          resolveTravelerPerson: async (db, contact, ctx) => {
            const person = await capabilities.relationshipsService.upsertPersonFromContact(
              db,
              contact,
              {
                source: ctx.source,
                sourceRef: ctx.sourceRef,
                requireContactPoint: true,
              },
            )
            return person?.id ?? null
          },
          resolveBillingPersonById: async (db, personId) =>
            (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
          resolveBillingOrganizationById: async (db, organizationId) =>
            (await capabilities.relationshipsService.getOrganizationById(db, organizationId)) !=
            null,
          closePaymentSchedulesForBooking: capabilities.closePaymentSchedulesForBooking,
          recordCancellationFinancialSettlement: capabilities.recordCancellationFinancialSettlement,
          customFields: capabilities.customFields,
          // Vertical enrichment seam (issue #2969): accommodations contributes
          // property / room / rate-plan / nightly-rate specifics to the public
          // guest-booking overview, keyed by the `accommodation` item type.
          overviewItemEnrichers: {
            accommodation: enrichStayBookingOverviewItems,
          },
        }),
        true,
      ),
    "@voyant-travel/public-document-delivery": ({ capabilities }) =>
      // Public document delivery (e.g. emailed contract/voucher links) is
      // reached without a session — the unguessable id in the path is the
      // credential.
      withAnonymous(
        createPublicDocumentDeliveryHonoModule({
          // Same storage backend as legal documents; the unknown-bindings
          // adapter keeps the provider contract uniform (the narrow-bindings
          // `createDocumentStorage` is retired in the deployment).
          resolveStorage: capabilities.createOperatorDocumentStorage,
        }),
        true,
      ),
    "@voyant-travel/notifications": ({ capabilities }) =>
      createNotificationsHonoModule({
        resolveProviders: capabilities.resolveNotificationProviders,
        resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
        resolveDocumentAttachmentResolver: (bindings) => async (document) => {
          if (document.storageKey) {
            const contentBase64 = await capabilities.readDocumentContentBase64(
              bindings,
              document.storageKey,
            )
            if (contentBase64) {
              return {
                filename: document.name,
                contentBase64,
                contentType: document.mimeType ?? undefined,
              }
            }
            const path = await capabilities.resolveDocumentDownloadUrl(
              bindings,
              document.storageKey,
            )
            if (path) {
              return {
                filename: document.name,
                path,
                contentType: document.mimeType ?? undefined,
              }
            }
          }
          return createDefaultBookingDocumentAttachment(document)
        },
        resolveDb: capabilities.resolveDb,
        autoConfirmAndDispatch: {
          enabled: true,
          templateSlug: "booking-confirmation",
          ...capabilities.notificationsAutoConfirmAndDispatch,
        },
      }),
    "@voyant-travel/legal": ({ capabilities }) =>
      // Storefront contract preview (slug resolution + by-slug render) is
      // reached during the auth-less booking journey, before any session.
      withAnonymous(
        createLegalHonoModule({
          resolveDb: capabilities.resolveDb,
          resolveDocumentDownloadUrl: (bindings, storageKey) =>
            capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
          resolveDocumentStorage: capabilities.createOperatorDocumentStorage,
          resolveDocumentGenerator: capabilities.resolveContractDocumentGenerator,
          resolveBookingPiiService: capabilities.createBookingPiiService,
          autoGenerateContractOnConfirmed: capabilities.autoGenerateContractOnConfirmed,
        }),
        true,
      ),
    "@voyant-travel/storefront/customer-portal": ({ capabilities }) =>
      // Only the pre-session contact-exists probe is anonymous; the rest of the
      // customer portal requires a resolved customer session.
      withAnonymous(
        createCustomerPortalHonoModule({
          resolveDocumentDownloadUrl: (bindings, storageKey) =>
            capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
        }),
        ["/contact-exists"],
      ),
    "@voyant-travel/storefront/verification": ({ capabilities }) =>
      // Storefront identity verification (send/confirm code) runs before a
      // session exists.
      withAnonymous(
        createStorefrontVerificationHonoModule({
          resolveProviders: capabilities.resolveNotificationProviders,
          email: { subject: "Your verification code" },
        }),
        true,
      ),
    "@voyant-travel/trips": ({ capabilities }) => {
      // Trips reserves trips via injected bookings deps — every trips surface
      // (admin/public/legacy) needs the transactional client, so the whole
      // module is name-based transactional (ADR-0008); no deployment path list.
      const trips = createTripsHonoModule({
        routesOptions: capabilities.createTripsRoutesOptions,
        publicRoutes: true,
      })
      return { ...trips, module: { ...trips.module, requiresTransactionalDb: true } }
    },
    // Standard settings module — schema-owning + lazy absolute-path routes, no
    // providers (reads its own tables). Stage 2 of the operator-settings
    // extraction; previously a deployment-local module.
    "@voyant-travel/operator-settings": () => createOperatorSettingsHonoModule(),
    // Tier 4 — lazy `operator/*` standard families. The framework owns the
    // manifest entry + path matchers; the deployment injects the `load` closure
    // that wires its providers into the package-owned route bundle.
    "@voyant-travel/flights": ({ capabilities }) => ({
      module: { name: "flights" },
      lazyAdminRoutes: capabilities.loadFlightAdminRoutes,
    }),
    "operator/mcp": ({ capabilities }) => ({
      module: { name: "mcp" },
      lazyAdminRoutes: capabilities.loadMcpAdminRoutes,
    }),
    "operator/catalog-booking": ({ capabilities }) => ({
      module: { name: "catalog-booking" },
      lazyRoutes: {
        paths: CATALOG_BOOKING_ROUTE_PATHS,
        load: capabilities.loadCatalogBookingRoutes,
      },
      // book/holds/orders/quote transact via the owned-product adapter; declared
      // here so the deployment's `dbTransactionalPaths` can be empty (ADR-0008).
      transactionalPaths: CATALOG_BOOKING_TRANSACTIONAL_PATHS,
    }),
    "operator/catalog-content": ({ capabilities }) => ({
      module: { name: "catalog-content" },
      lazyRoutes: {
        paths: CATALOG_CONTENT_ROUTE_PATHS,
        load: capabilities.loadCatalogContentRoutes,
      },
    }),
    "operator/media": ({ capabilities }) => ({
      module: { name: "media" },
      lazyRoutes: { paths: MEDIA_ROUTE_PATHS, load: capabilities.loadMediaRoutes },
    }),
    "operator/payment-link": ({ capabilities }) => ({
      module: { name: "payment-link" },
      publicPath: "/",
      lazyRoutes: { paths: PAYMENT_LINK_ROUTE_PATHS, load: capabilities.loadPaymentLinkRoutes },
      anonymous: ["payment-link-config", "payment-link"],
    }),
    "operator/contract-document": ({ capabilities }) => ({
      module: { name: "contract-document" },
      lazyRoutes: {
        paths: CONTRACT_DOCUMENT_ROUTE_PATHS,
        load: capabilities.loadContractDocumentRoutes,
      },
    }),
  },
  extensions: {
    // Tier 3 — pure singleton extensions (no providers).
    "@voyant-travel/bookings/booking-supplier-extension": () => bookingsSupplierExtension,
    "@voyant-travel/finance/bookings-create-extension": () => bookingsCreateExtension,
    "@voyant-travel/inventory/booking-extension": () => inventoryBookingExtension,
    "@voyant-travel/inventory/authoring/extension": () => inventoryAuthoringExtension,
    "@voyant-travel/quotes/booking-extension": () => quotesBookingExtension,
    "@voyant-travel/distribution": () => distributionBookingExtension,
    // Injection-shaped extensions — deployment-specific builders/readers via ctx.
    "@voyant-travel/distribution/channel-push-extension": ({ capabilities }) =>
      capabilities.createChannelPushExtension(),
    // Booking-tax settings are read straight from the standard
    // @voyant-travel/operator-settings package — no per-deployment injection.
    "@voyant-travel/finance/booking-tax-extension": () =>
      createBookingTaxHonoExtension({ resolveBookingTaxSettings, updateBookingTaxSettings }),
    // Tier 4 — lazy `operator/*` standard extensions. The framework owns the
    // `extension` metadata + publicPath; the deployment injects builders/loaders.
    "operator/booking-schedule-extension": ({ capabilities }) =>
      capabilities.createBookingScheduleExtension(),
    "operator/quote-version-snapshot-extension": ({ capabilities }) =>
      capabilities.createQuoteVersionSnapshotExtension(),
    "operator/booking-maintenance-extension": ({ capabilities }) => ({
      extension: { name: "booking-maintenance", module: "bookings" },
      lazyAdminRoutes: capabilities.loadBookingMaintenanceRoutes,
    }),
    "operator/action-ledger-health-extension": ({ capabilities }) => ({
      extension: { name: "action-ledger-health", module: "action-ledger" },
      lazyAdminRoutes: capabilities.loadActionLedgerHealthRoutes,
    }),
    "operator/proposal-extension": ({ capabilities }) => ({
      extension: { name: "proposal", module: "quote-versions" },
      publicPath: "proposals",
      lazyAdminRoutes: capabilities.loadProposalAdminRoutes,
      lazyPublicRoutes: capabilities.loadProposalPublicRoutes,
      // The customer-facing sent proposal (accept/decline) is opened from an
      // emailed link before any session — anonymous, customer-safe DTO only.
      anonymous: true,
    }),
    "operator/catalog-offers-extension": ({ capabilities }) => ({
      extension: { name: "catalog-offers", module: "catalog" },
      lazyAdminRoutes: capabilities.loadCatalogOffersRoutes,
    }),
    "operator/catalog-checkout-extension": ({ capabilities }) => ({
      extension: { name: "catalog-checkout", module: "catalog" },
      lazyPublicRoutes: capabilities.loadCatalogCheckoutRoutes,
    }),
  },
}
