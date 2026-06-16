/**
 * The standard Voyant runtime composition registry — the package-owned half of
 * `OPERATOR_RUNTIME_MANIFEST`'s factories.
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
  type BookingTaxRouteOptions,
  bookingsCreateExtension,
  createBookingTaxHonoExtension,
  createFinanceHonoModule,
  type FinanceHonoModuleOptions,
} from "@voyant-travel/finance"
import type {
  CheckoutNotificationDelivery,
  CheckoutPaymentStarter,
} from "@voyant-travel/finance/checkout"
import type { CheckoutReminderRunRecord } from "@voyant-travel/finance/checkout-validation"
import { createPublicDocumentDeliveryHonoModule } from "@voyant-travel/hono"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import { identityHonoModule } from "@voyant-travel/identity"
import { inventoryBookingExtension, inventoryHonoModule } from "@voyant-travel/inventory"
import { inventoryAuthoringExtension } from "@voyant-travel/inventory/authoring/extension"
import { inventoryExtrasRoutes } from "@voyant-travel/inventory/extras"
import { type CreateLegalHonoModuleOptions, createLegalHonoModule } from "@voyant-travel/legal"
import {
  type CreateNotificationsHonoModuleOptions,
  createDefaultBookingDocumentAttachment,
  createNotificationService,
  createNotificationsHonoModule,
  notificationsService,
} from "@voyant-travel/notifications"
import { operationsHonoModule } from "@voyant-travel/operations"
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
import { createTripsHonoModule, type TripsRoutesOptions } from "@voyant-travel/trips"
import { Hono } from "hono"

/**
 * Combined "extras" surface — inventory + bookings package extras routes mounted
 * on one module. Pure composition of package route sets (no providers); the
 * deployment used to build this inline.
 */
const extrasHonoModule = {
  module: { name: "extras" },
  routes: new Hono().route("/", inventoryExtrasRoutes).route("/", bookingsExtrasRoutes),
} satisfies HonoModule

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
  relationshipsService: typeof relationshipsService
  /** Closes a booking's terminal payment schedules (bookings module option). */
  closePaymentSchedulesForBooking: NonNullable<
    BookingsHonoModuleOptions["closePaymentSchedulesForBooking"]
  >
  /** Resolves a stored document's download URL (bindings + storage key). */
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) => Promise<string | null>
  /** Resolves the notification providers for the verification challenge. */
  resolveNotificationProviders: NonNullable<StorefrontVerificationRoutesOptions["resolveProviders"]>
  /** Deployment-built trips route options (connector, payment wiring, …). */
  createTripsRoutesOptions: () => TripsRoutesOptions
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
  /** The configured pay-by-link starter (Netopia; env resolved lazily). */
  netopiaCheckoutStarter: CheckoutPaymentStarter
  /** Reads the booking tax settings (finance booking-tax extension). */
  resolveBookingTaxSettings: NonNullable<BookingTaxRouteOptions["resolveBookingTaxSettings"]>
  /** Updates the booking tax settings (finance booking-tax extension). */
  updateBookingTaxSettings: NonNullable<BookingTaxRouteOptions["updateBookingTaxSettings"]>
  /** Builds the distribution channel-push extension (deployment booking-engine wiring). */
  createChannelPushExtension: () => HonoExtension
}

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
    "@voyant-travel/relationships": () => createRelationshipsHonoModule(),
    "@voyant-travel/quotes": () => createQuotesHonoModule(),
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
    "@voyant-travel/storefront": ({ capabilities }) =>
      createStorefrontHonoModule({
        offers: createCommerceStorefrontOfferResolvers(),
        // Async booking-bootstrap intents (queued write pipeline, RFC
        // voyant#1687 §3.2) — the handler runs on the app bus with
        // outbox-grade retries; the */2min cron sweeps stale intents.
        bookingIntents: { resolveDb: capabilities.resolveDb },
        intake: { persistence: capabilities.storefrontIntakePersistence },
      }),
    "@voyant-travel/finance": ({ capabilities }) =>
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
        resolvePaymentStarters: (): Record<string, CheckoutPaymentStarter> => ({
          netopia: capabilities.netopiaCheckoutStarter,
        }),
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
    "@voyant-travel/bookings": ({ capabilities }) =>
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
          (await capabilities.relationshipsService.getOrganizationById(db, organizationId)) != null,
        closePaymentSchedulesForBooking: capabilities.closePaymentSchedulesForBooking,
      }),
    "@voyant-travel/public-document-delivery": ({ capabilities }) =>
      createPublicDocumentDeliveryHonoModule({
        // Same storage backend as legal documents; the unknown-bindings
        // adapter keeps the provider contract uniform (the narrow-bindings
        // `createDocumentStorage` is retired in the deployment).
        resolveStorage: capabilities.createOperatorDocumentStorage,
      }),
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
        autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
      }),
    "@voyant-travel/legal": ({ capabilities }) =>
      createLegalHonoModule({
        resolveDb: capabilities.resolveDb,
        resolveDocumentDownloadUrl: (bindings, storageKey) =>
          capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
        resolveDocumentStorage: capabilities.createOperatorDocumentStorage,
        resolveDocumentGenerator: capabilities.resolveContractDocumentGenerator,
        resolveBookingPiiService: capabilities.createBookingPiiService,
        autoGenerateContractOnConfirmed: capabilities.autoGenerateContractOnConfirmed,
      }),
    "@voyant-travel/storefront/customer-portal": ({ capabilities }) =>
      createCustomerPortalHonoModule({
        resolveDocumentDownloadUrl: (bindings, storageKey) =>
          capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
      }),
    "@voyant-travel/storefront/verification": ({ capabilities }) =>
      createStorefrontVerificationHonoModule({
        resolveProviders: capabilities.resolveNotificationProviders,
        email: { subject: "Your verification code" },
      }),
    "@voyant-travel/trips": ({ capabilities }) =>
      createTripsHonoModule({
        ...capabilities.createTripsRoutesOptions(),
        publicRoutes: true,
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
    "@voyant-travel/finance/booking-tax-extension": ({ capabilities }) =>
      createBookingTaxHonoExtension({
        resolveBookingTaxSettings: capabilities.resolveBookingTaxSettings,
        updateBookingTaxSettings: capabilities.updateBookingTaxSettings,
      }),
  },
}
