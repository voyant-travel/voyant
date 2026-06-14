/**
 * Manifest-driven runtime composition for the operator template.
 *
 * Instead of hand-listing `createApp({ modules, extensions })`, `app.ts`
 * derives those arrays from this registry via
 * `composeFromManifest(manifest, registry, capabilities)`
 * (`@voyantjs/hono/composition`). This is the runtime half of the
 * migration-resilience work (voyant#1608 / #1620): the manifest is the source
 * of truth, capabilities are gathered in one typed container, and each entry
 * maps to a factory.
 *
 * `OPERATOR_RUNTIME_MANIFEST` is the ordered runtime module/extension list —
 * mount + hook-registration order is significant, so it mirrors the previous
 * hand-written array order exactly. `voyant db doctor` cross-checks it against
 * `voyant.config.ts` (the schema manifest).
 */

// Singleton modules (no template-specific options).
import { actionLedgerHonoModule } from "@voyantjs/action-ledger"
import { bookingsSupplierExtension, createBookingsHonoModule } from "@voyantjs/bookings"
import { bookingsExtrasHonoModule } from "@voyantjs/bookings/extras"
import { createBookingRequirementsHonoModule } from "@voyantjs/bookings/requirements"
import {
  createCatalogSearchHonoModule,
  type EmbeddingProvider,
  executeSemanticSearch,
} from "@voyantjs/catalog"
import {
  createCommerceHonoModules,
  createCommerceStorefrontOfferResolvers,
} from "@voyantjs/commerce"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/distribution/external-refs"
import { suppliersHonoModule } from "@voyantjs/distribution/suppliers"
import { bookingsCreateExtension, createFinanceHonoModule } from "@voyantjs/finance"
import type {
  CheckoutNotificationDelivery,
  CheckoutPaymentStarter,
} from "@voyantjs/finance/checkout"
import { createPublicDocumentDeliveryHonoModule } from "@voyantjs/hono"
import type { CompositionManifest, CompositionRegistry } from "@voyantjs/hono/composition"
import { identityHonoModule } from "@voyantjs/identity"
import { inventoryBookingExtension, inventoryHonoModule } from "@voyantjs/inventory"
import { inventoryAuthoringExtension } from "@voyantjs/inventory/authoring/extension"
import { createLegalHonoModule } from "@voyantjs/legal"
import {
  createDefaultBookingDocumentAttachment,
  createNotificationService,
  createNotificationsHonoModule,
  notificationsService,
} from "@voyantjs/notifications"
import { availabilityHonoModule } from "@voyantjs/operations/availability"
import { resourcesHonoModule } from "@voyantjs/operations/resources"
import { createNetopiaCheckoutStarter } from "@voyantjs/plugin-netopia"
import { createQuotesHonoModule, quotesBookingExtension } from "@voyantjs/quotes"
import { createRelationshipsHonoModule, relationshipsService } from "@voyantjs/relationships"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { createStorefrontVerificationHonoModule } from "@voyantjs/storefront-verification"
import { createTripComposerHonoModule } from "@voyantjs/trip-composer"

import { resolveNotificationProviders } from "../lib/notifications"
import { closeTerminalBookingPaymentSchedules } from "./booking-payment-cleanup"
import { AUTO_GENERATE_CONTRACT_OPTIONS } from "./contract-document-runtime"
import { resolveBookingRequirementsProductSnapshot } from "./lib/booking-requirements-product-snapshot"
import { buildCatalogContext } from "./lib/catalog-context"
import { createDocumentStorage } from "./lib/storage"
import {
  createOperatorBookingPiiService,
  createOperatorDocumentStorage,
  createOperatorInvoiceExchangeRateResolver,
  createOperatorInvoiceSettlementPollers,
  readOperatorDocumentContentBase64,
  resolveOperatorContractDocumentGenerator,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./operator-runtime-adapter"
import {
  resolveBankTransferDetails,
  resolvePublicCheckoutBaseUrlFromBindings,
} from "./payment-config"
import { createRelationshipsStorefrontIntakePersistence } from "./storefront-intake-runtime"
import { createOperatorTripComposerRoutesOptions } from "./trip-composer-runtime"

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

/**
 * The operator deployment's capability container. Every template-specific
 * resolver/service a module factory needs is gathered here so wiring lives in
 * one typed place rather than being threaded through `createApp`.
 */
export interface OperatorCapabilities {
  resolveNotificationProviders: typeof resolveNotificationProviders
  resolvePublicCheckoutBaseUrl: typeof resolvePublicCheckoutBaseUrlFromBindings
  resolveDocumentDownloadUrl: typeof resolveOperatorDocumentDownloadUrl
  readDocumentContentBase64: typeof readOperatorDocumentContentBase64
  resolveDb: typeof resolveOperatorDb
  createDocumentStorage: typeof createDocumentStorage
  createOperatorDocumentStorage: typeof createOperatorDocumentStorage
  createInvoiceExchangeRateResolver: typeof createOperatorInvoiceExchangeRateResolver
  createInvoiceSettlementPollers: typeof createOperatorInvoiceSettlementPollers
  resolveContractDocumentGenerator: typeof resolveOperatorContractDocumentGenerator
  createBookingPiiService: typeof createOperatorBookingPiiService
  autoGenerateContractOnConfirmed: typeof AUTO_GENERATE_CONTRACT_OPTIONS
  resolveBankTransferDetails: typeof resolveBankTransferDetails
  relationshipsService: typeof relationshipsService
  closePaymentSchedulesForBooking: typeof closeTerminalBookingPaymentSchedules
  buildCatalogContext: typeof buildCatalogContext
  createTripComposerRoutesOptions: typeof createOperatorTripComposerRoutesOptions
  /** Netopia is the only configured pay-by-link starter (env resolved lazily). */
  netopiaCheckoutStarter: CheckoutPaymentStarter
}

/** Build the operator capability container (gathers deployment resolvers). */
export function buildOperatorCapabilities(): OperatorCapabilities {
  return {
    resolveNotificationProviders,
    resolvePublicCheckoutBaseUrl: resolvePublicCheckoutBaseUrlFromBindings,
    resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
    readDocumentContentBase64: readOperatorDocumentContentBase64,
    resolveDb: resolveOperatorDb,
    createDocumentStorage,
    createOperatorDocumentStorage,
    createInvoiceExchangeRateResolver: createOperatorInvoiceExchangeRateResolver,
    createInvoiceSettlementPollers: createOperatorInvoiceSettlementPollers,
    resolveContractDocumentGenerator: resolveOperatorContractDocumentGenerator,
    createBookingPiiService: createOperatorBookingPiiService,
    autoGenerateContractOnConfirmed: AUTO_GENERATE_CONTRACT_OPTIONS,
    resolveBankTransferDetails,
    relationshipsService,
    closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    buildCatalogContext,
    createTripComposerRoutesOptions: createOperatorTripComposerRoutesOptions,
    netopiaCheckoutStarter: createNetopiaCheckoutStarter(),
  }
}

/**
 * Ordered runtime composition — module/extension specifiers in mount order.
 * Keep in sync with `voyant.config.ts`; `voyant db doctor` enforces parity for
 * the schema-bearing subset.
 */
export const OPERATOR_RUNTIME_MANIFEST = {
  modules: [
    "@voyantjs/action-ledger",
    "@voyantjs/relationships",
    "@voyantjs/quotes",
    "@voyantjs/operations/availability",
    "@voyantjs/identity",
    "@voyantjs/distribution/external-refs",
    "@voyantjs/bookings/extras",
    "@voyantjs/bookings/requirements",
    "@voyantjs/commerce",
    "@voyantjs/operations/resources",
    "@voyantjs/distribution",
    "@voyantjs/distribution/suppliers",
    "@voyantjs/inventory",
    "@voyantjs/catalog",
    "@voyantjs/bookings",
    "@voyantjs/finance",
    "@voyantjs/legal",
    "@voyantjs/public-document-delivery",
    "@voyantjs/notifications",
    "@voyantjs/storefront",
    "@voyantjs/customer-portal",
    "@voyantjs/storefront-verification",
    "@voyantjs/trip-composer",
  ],
  extensions: [
    "@voyantjs/bookings/booking-supplier-extension",
    "@voyantjs/finance/bookings-create-extension",
    "@voyantjs/inventory/booking-extension",
    "@voyantjs/inventory/authoring/extension",
    "@voyantjs/quotes/booking-extension",
    "@voyantjs/distribution/booking-extension",
  ],
} satisfies CompositionManifest

/** Factory registry keyed by the manifest specifiers above. */
export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
  modules: {
    "@voyantjs/action-ledger": () => actionLedgerHonoModule,
    "@voyantjs/relationships": () => createRelationshipsHonoModule(),
    "@voyantjs/quotes": () => createQuotesHonoModule(),
    "@voyantjs/operations/availability": () => availabilityHonoModule,
    "@voyantjs/identity": () => identityHonoModule,
    "@voyantjs/distribution/external-refs": () => externalRefsHonoModule,
    "@voyantjs/bookings/extras": () => bookingsExtrasHonoModule,
    "@voyantjs/bookings/requirements": () =>
      createBookingRequirementsHonoModule({
        publicRoutes: {
          resolveProductSnapshot: resolveBookingRequirementsProductSnapshot,
        },
      }),
    "@voyantjs/commerce": () => createCommerceHonoModules(),
    "@voyantjs/operations/resources": () => resourcesHonoModule,
    "@voyantjs/distribution": () => distributionHonoModule,
    "@voyantjs/distribution/suppliers": () => suppliersHonoModule,
    "@voyantjs/inventory": () => inventoryHonoModule,
    "@voyantjs/catalog": ({ capabilities }) =>
      createCatalogSearchHonoModule({
        resolveRuntime: (c) => {
          const ctx = capabilities.buildCatalogContext(c)
          return {
            indexer: ctx.catalog.indexer,
            embeddings: ctx.catalog.embeddings,
            defaultScope: ctx.defaultScope,
          }
        },
        executeSearch: ({ adapter, embeddings, slice, request }) =>
          executeSemanticSearch({
            adapter,
            embeddings: embeddings as EmbeddingProvider | undefined,
            slice,
            request,
          }),
      }),
    "@voyantjs/bookings": ({ capabilities }) =>
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
    "@voyantjs/finance": ({ capabilities }) =>
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
      }),
    "@voyantjs/legal": ({ capabilities }) =>
      createLegalHonoModule({
        resolveDb: capabilities.resolveDb,
        resolveDocumentDownloadUrl: (bindings, storageKey) =>
          capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
        resolveDocumentStorage: capabilities.createOperatorDocumentStorage,
        resolveDocumentGenerator: capabilities.resolveContractDocumentGenerator,
        resolveBookingPiiService: capabilities.createBookingPiiService,
        autoGenerateContractOnConfirmed: capabilities.autoGenerateContractOnConfirmed,
      }),
    "@voyantjs/public-document-delivery": ({ capabilities }) =>
      createPublicDocumentDeliveryHonoModule({
        resolveStorage: capabilities.createDocumentStorage,
      }),
    "@voyantjs/notifications": ({ capabilities }) =>
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
    "@voyantjs/storefront": ({ capabilities }) =>
      createStorefrontHonoModule({
        offers: createCommerceStorefrontOfferResolvers(),
        // Async booking-bootstrap intents (queued write pipeline, RFC
        // voyant#1687 §3.2) — the handler runs on the app bus with
        // outbox-grade retries; the */2min cron sweeps stale intents.
        bookingIntents: { resolveDb: capabilities.resolveDb },
        intake: {
          persistence: createRelationshipsStorefrontIntakePersistence(),
        },
      }),
    "@voyantjs/customer-portal": ({ capabilities }) =>
      createCustomerPortalHonoModule({
        resolveDocumentDownloadUrl: (bindings, storageKey) =>
          capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
      }),
    "@voyantjs/storefront-verification": ({ capabilities }) =>
      createStorefrontVerificationHonoModule({
        resolveProviders: capabilities.resolveNotificationProviders,
        email: { subject: "Your verification code" },
      }),
    "@voyantjs/trip-composer": ({ capabilities }) =>
      createTripComposerHonoModule({
        ...capabilities.createTripComposerRoutesOptions(),
        publicRoutes: true,
      }),
  },
  extensions: {
    "@voyantjs/bookings/booking-supplier-extension": () => bookingsSupplierExtension,
    "@voyantjs/finance/bookings-create-extension": () => bookingsCreateExtension,
    "@voyantjs/inventory/booking-extension": () => inventoryBookingExtension,
    "@voyantjs/inventory/authoring/extension": () => inventoryAuthoringExtension,
    "@voyantjs/quotes/booking-extension": () => quotesBookingExtension,
    "@voyantjs/distribution/booking-extension": () => distributionBookingExtension,
  },
}
