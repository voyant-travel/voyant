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
import { availabilityHonoModule } from "@voyantjs/availability"
import { bookingsSupplierExtension, createBookingsHonoModule } from "@voyantjs/bookings"
import { createBookingRequirementsHonoModule } from "@voyantjs/bookings/requirements"
import { createCatalogSearchHonoModule } from "@voyantjs/catalog"
import { catalogAuthoringExtension } from "@voyantjs/catalog-authoring"
import { type EmbeddingProvider, executeSemanticSearch } from "@voyantjs/catalog-rag"
import { type CheckoutPaymentStarter, createCheckoutHonoModule } from "@voyantjs/checkout"
import {
  createCommerceHonoModules,
  createCommerceStorefrontOfferResolvers,
} from "@voyantjs/commerce"
import { createCrmHonoModule, crmBookingExtension, crmService } from "@voyantjs/crm"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/external-refs"
import { extrasHonoModule } from "@voyantjs/extras"
import { bookingsCreateExtension, createFinanceHonoModule } from "@voyantjs/finance"
import { createPublicDocumentDeliveryHonoModule } from "@voyantjs/hono"
import type { CompositionManifest, CompositionRegistry } from "@voyantjs/hono/composition"
import { identityHonoModule } from "@voyantjs/identity"
import { createLegalHonoModule } from "@voyantjs/legal"
import {
  createDefaultBookingDocumentAttachment,
  createNotificationsHonoModule,
} from "@voyantjs/notifications"
import { createNetopiaCheckoutStarter } from "@voyantjs/plugin-netopia"
import { productsBookingExtension, productsHonoModule } from "@voyantjs/products"
import { resourcesHonoModule } from "@voyantjs/resources"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { createStorefrontVerificationHonoModule } from "@voyantjs/storefront-verification"
import { suppliersHonoModule } from "@voyantjs/suppliers"
import { transactionsBookingExtension, transactionsHonoModule } from "@voyantjs/transactions"
import { createTravelComposerHonoModule } from "@voyantjs/travel-composer"

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
import { createOperatorTravelComposerRoutesOptions } from "./travel-composer-runtime"

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
  crmService: typeof crmService
  closePaymentSchedulesForBooking: typeof closeTerminalBookingPaymentSchedules
  buildCatalogContext: typeof buildCatalogContext
  createTravelComposerRoutesOptions: typeof createOperatorTravelComposerRoutesOptions
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
    crmService,
    closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    buildCatalogContext,
    createTravelComposerRoutesOptions: createOperatorTravelComposerRoutesOptions,
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
    "@voyantjs/crm",
    "@voyantjs/availability",
    "@voyantjs/identity",
    "@voyantjs/external-refs",
    "@voyantjs/extras",
    "@voyantjs/bookings/requirements",
    "@voyantjs/commerce",
    "@voyantjs/transactions",
    "@voyantjs/resources",
    "@voyantjs/distribution",
    "@voyantjs/suppliers",
    "@voyantjs/products",
    "@voyantjs/catalog",
    "@voyantjs/bookings",
    "@voyantjs/finance",
    "@voyantjs/legal",
    "@voyantjs/public-document-delivery",
    "@voyantjs/notifications",
    "@voyantjs/storefront",
    "@voyantjs/customer-portal",
    "@voyantjs/storefront-verification",
    "@voyantjs/checkout",
    "@voyantjs/travel-composer",
  ],
  extensions: [
    "@voyantjs/bookings/booking-supplier-extension",
    "@voyantjs/finance/bookings-create-extension",
    "@voyantjs/products/booking-extension",
    "@voyantjs/catalog-authoring/extension",
    "@voyantjs/crm/booking-extension",
    "@voyantjs/transactions/booking-extension",
    "@voyantjs/distribution/booking-extension",
  ],
} satisfies CompositionManifest

/** Factory registry keyed by the manifest specifiers above. */
export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
  modules: {
    "@voyantjs/action-ledger": () => actionLedgerHonoModule,
    "@voyantjs/crm": () => createCrmHonoModule(),
    "@voyantjs/availability": () => availabilityHonoModule,
    "@voyantjs/identity": () => identityHonoModule,
    "@voyantjs/external-refs": () => externalRefsHonoModule,
    "@voyantjs/extras": () => extrasHonoModule,
    "@voyantjs/bookings/requirements": () =>
      createBookingRequirementsHonoModule({
        publicRoutes: {
          resolveProductSnapshot: resolveBookingRequirementsProductSnapshot,
        },
      }),
    "@voyantjs/commerce": () => createCommerceHonoModules(),
    "@voyantjs/transactions": () => transactionsHonoModule,
    "@voyantjs/resources": () => resourcesHonoModule,
    "@voyantjs/distribution": () => distributionHonoModule,
    "@voyantjs/suppliers": () => suppliersHonoModule,
    "@voyantjs/products": () => productsHonoModule,
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
          capabilities.crmService.loadPersonTravelSnapshot(db, personId, { kms }),
        resolveBillingPerson: async (db, contact, ctx) => {
          const person = await capabilities.crmService.upsertPersonFromContact(db, contact, {
            source: ctx.source,
            sourceRef: ctx.sourceRef,
          })
          return person?.id ?? null
        },
        resolveTravelerPerson: async (db, contact, ctx) => {
          const person = await capabilities.crmService.upsertPersonFromContact(db, contact, {
            source: ctx.source,
            sourceRef: ctx.sourceRef,
            requireContactPoint: true,
          })
          return person?.id ?? null
        },
        resolveBillingPersonById: async (db, personId) =>
          (await capabilities.crmService.getPersonById(db, personId)) != null,
        resolveBillingOrganizationById: async (db, organizationId) =>
          (await capabilities.crmService.getOrganizationById(db, organizationId)) != null,
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
    "@voyantjs/checkout": ({ capabilities }) =>
      createCheckoutHonoModule({
        resolveProviders: capabilities.resolveNotificationProviders,
        resolvePaymentStarters: (): Record<string, CheckoutPaymentStarter> => ({
          netopia: capabilities.netopiaCheckoutStarter,
        }),
        resolveBankTransferDetails: capabilities.resolveBankTransferDetails,
        resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
      }),
    "@voyantjs/travel-composer": ({ capabilities }) =>
      createTravelComposerHonoModule({
        ...capabilities.createTravelComposerRoutesOptions(),
        publicRoutes: true,
      }),
  },
  extensions: {
    "@voyantjs/bookings/booking-supplier-extension": () => bookingsSupplierExtension,
    "@voyantjs/finance/bookings-create-extension": () => bookingsCreateExtension,
    "@voyantjs/products/booking-extension": () => productsBookingExtension,
    "@voyantjs/catalog-authoring/extension": () => catalogAuthoringExtension,
    "@voyantjs/crm/booking-extension": () => crmBookingExtension,
    "@voyantjs/transactions/booking-extension": () => transactionsBookingExtension,
    "@voyantjs/distribution/booking-extension": () => distributionBookingExtension,
  },
}
