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
import { type BookingsHonoModuleOptions, createBookingsHonoModule } from "@voyant-travel/bookings"
import { bookingsExtrasRoutes } from "@voyant-travel/bookings/extras"
import {
  type BookingRequirementsHonoModuleOptions,
  createBookingRequirementsHonoModule,
} from "@voyant-travel/bookings/requirements"
import { createCommerceHonoModules } from "@voyant-travel/commerce"
import {
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "@voyant-travel/distribution"
import { createPublicDocumentDeliveryHonoModule } from "@voyant-travel/hono"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import type { HonoModule } from "@voyant-travel/hono/module"
import { identityHonoModule } from "@voyant-travel/identity"
import { inventoryHonoModule } from "@voyant-travel/inventory"
import { inventoryExtrasRoutes } from "@voyant-travel/inventory/extras"
import { type CreateLegalHonoModuleOptions, createLegalHonoModule } from "@voyant-travel/legal"
import {
  type CreateNotificationsHonoModuleOptions,
  createDefaultBookingDocumentAttachment,
  createNotificationsHonoModule,
} from "@voyant-travel/notifications"
import { operationsHonoModule } from "@voyant-travel/operations"
import { createQuotesHonoModule } from "@voyant-travel/quotes"
import {
  createRelationshipsHonoModule,
  type relationshipsService,
} from "@voyant-travel/relationships"
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
  extensions: {},
}
