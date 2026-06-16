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
import { createCommerceHonoModules } from "@voyant-travel/commerce"
import {
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "@voyant-travel/distribution"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import { identityHonoModule } from "@voyant-travel/identity"
import { inventoryHonoModule } from "@voyant-travel/inventory"
import { type CreateLegalHonoModuleOptions, createLegalHonoModule } from "@voyant-travel/legal"
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
