/**
 * Manifest-driven runtime composition for the operator starter.
 *
 * agent-quality: file-size exception -- this is the deployment's single
 * composition source of truth (one factory entry per mounted module/extension,
 * now that every route family composes here instead of ad-hoc additionalRoutes).
 * Keeping the manifest + registry + capabilities in one file is intentional; the
 * length scales with the module count, not with logic complexity.
 *
 * The standard module/extension set + their order are owned by
 * @voyant-travel/framework. `app.ts` calls `createVoyantApp({ providers,
 * modules })` which assembles `FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition`
 * with this deployment's injected providers + `deploymentLocalModules`, then
 * composes + mounts. This file owns only the deployment-specific bits: the
 * provider container (`buildOperatorProviders`) and the two deployment-local
 * module factories. `OPERATOR_RUNTIME_MANIFEST` + `operatorComposition` remain as
 * DERIVED exports for `voyant db doctor` parity + the composition tests. This is
 * the runtime half of the migration-resilience work (voyant#1608 / #1620).
 */

import {
  FRAMEWORK_RUNTIME_MANIFEST,
  type FrameworkProviders,
  frameworkComposition,
} from "@voyant-travel/framework"
import type { VoyantDb } from "@voyant-travel/hono"
import type {
  CompositionManifest,
  CompositionRegistry,
  ModuleFactory,
} from "@voyant-travel/hono/composition"
import { createNetopiaCheckoutStarter } from "@voyant-travel/plugin-netopia"
import { relationshipsService } from "@voyant-travel/relationships"
import { Hono } from "hono"
import { resolveNotificationProviders } from "../lib/notifications"
import { resolveBookingRequirementsProductSnapshot } from "./lib/booking-requirements-product-snapshot"
import { buildCatalogContext } from "./lib/catalog-context"
import { createBookingScheduleExtension } from "./routes/booking-schedule"
import { createChannelPushExtension } from "./routes/channel-push"
import { createOperatorQuoteVersionSnapshotExtension } from "./routes/quote-version-snapshot-routes"
import { AUTO_GENERATE_CONTRACT_OPTIONS } from "./runtime/contract-document-runtime"
import {
  createOperatorBookingPiiService,
  createOperatorDocumentStorage,
  createOperatorInvoiceExchangeRateResolver,
  createOperatorInvoiceSettlementPollers,
  readOperatorDocumentContentBase64,
  resolveOperatorContractDocumentGenerator,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./runtime/operator-runtime-adapter"
import {
  resolveBankTransferDetails,
  resolvePublicCheckoutBaseUrlFromBindings,
} from "./runtime/payment-config"
import { createRelationshipsStorefrontIntakePersistence } from "./runtime/storefront-intake-runtime"
import { createOperatorTripsRoutesOptions } from "./runtime/trips-runtime"
import { closeTerminalBookingPaymentSchedules } from "./subscribers/booking-payment-cleanup"

/**
 * The operator deployment's capability container. Every template-specific
 * resolver/service a module factory needs is gathered here so wiring lives in
 * one typed place rather than being threaded through `createApp`.
 */
// `extends FrameworkProviders` is the compile-time guard that this container
// satisfies the framework's injected provider contract (so the relocated
// `frameworkComposition` factories can read it). A future framework provider
// addition becomes required here, failing the operator typecheck until
// `buildOperatorProviders` wires it — that's the intended forcing function.
export interface OperatorCapabilities extends FrameworkProviders {
  resolveNotificationProviders: typeof resolveNotificationProviders
  resolvePublicCheckoutBaseUrl: typeof resolvePublicCheckoutBaseUrlFromBindings
  resolveDocumentDownloadUrl: typeof resolveOperatorDocumentDownloadUrl
  readDocumentContentBase64: typeof readOperatorDocumentContentBase64
  resolveDb: typeof resolveOperatorDb
  createOperatorDocumentStorage: typeof createOperatorDocumentStorage
  resolveContractDocumentGenerator: typeof resolveOperatorContractDocumentGenerator
  createBookingPiiService: typeof createOperatorBookingPiiService
  autoGenerateContractOnConfirmed: typeof AUTO_GENERATE_CONTRACT_OPTIONS
  resolveBankTransferDetails: typeof resolveBankTransferDetails
  relationshipsService: typeof relationshipsService
  closePaymentSchedulesForBooking: typeof closeTerminalBookingPaymentSchedules
  createTripsRoutesOptions: typeof createOperatorTripsRoutesOptions
  resolveBookingRequirementsProductSnapshot: typeof resolveBookingRequirementsProductSnapshot
}

/**
 * Build the operator provider container (gathers deployment resolvers/loaders).
 * Providers are bindings-deferred closures, so no `env` is needed here.
 */
export function buildOperatorProviders(): OperatorCapabilities {
  return {
    resolveNotificationProviders,
    resolvePublicCheckoutBaseUrl: resolvePublicCheckoutBaseUrlFromBindings,
    resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
    readDocumentContentBase64: readOperatorDocumentContentBase64,
    resolveDb: resolveOperatorDb,
    createOperatorDocumentStorage,
    createInvoiceExchangeRateResolver: createOperatorInvoiceExchangeRateResolver,
    createInvoiceSettlementPollers: createOperatorInvoiceSettlementPollers,
    resolveContractDocumentGenerator: resolveOperatorContractDocumentGenerator,
    createBookingPiiService: createOperatorBookingPiiService,
    autoGenerateContractOnConfirmed: AUTO_GENERATE_CONTRACT_OPTIONS,
    resolveBankTransferDetails,
    relationshipsService,
    closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    // Adapt the deployment's catalog context into the package's search runtime
    // shape (the framework catalog factory consumes this directly).
    resolveCatalogRuntime: (c) => {
      const ctx = buildCatalogContext(c)
      return {
        indexer: ctx.catalog.indexer,
        embeddings: ctx.catalog.embeddings,
        defaultScope: ctx.defaultScope,
      }
    },
    createTripsRoutesOptions: createOperatorTripsRoutesOptions,
    resolveBookingRequirementsProductSnapshot,
    storefrontIntakePersistence: createRelationshipsStorefrontIntakePersistence(),
    netopiaCheckoutStarter: createNetopiaCheckoutStarter(),
    createChannelPushExtension,
    // Lazy route-bundle loaders for the `operator/*` standard families — each
    // wires this deployment's providers into the package-owned route bundle.
    loadFlightAdminRoutes: () =>
      import("./runtime/flights-runtime").then((m) => m.buildFlightAdminRoutes()),
    loadMcpAdminRoutes: () => import("./runtime/mcp-runtime").then((m) => m.buildMcpAdminRoutes()),
    loadCatalogBookingRoutes: () =>
      import("./runtime/catalog-booking-runtime").then((m) => {
        const app = new Hono()
        m.mountCatalogBookingRoutes(app)
        return app
      }),
    loadCatalogContentRoutes: () =>
      import("./routes/catalog-content").then((m) => {
        const app = new Hono()
        m.mountCatalogContentRoutes(app)
        return app
      }),
    loadMediaRoutes: () =>
      import("./runtime/media-runtime").then((m) => m.buildOperatorMediaRoutes()),
    loadPaymentLinkRoutes: () =>
      import("./runtime/payment-link-runtime").then((m) => m.buildOperatorPaymentLinkRoutes()),
    loadContractDocumentRoutes: () =>
      import("./runtime/contract-document-runtime").then((m) => m.buildContractDocumentRoutes()),
    // Lazy `operator/*` standard extension builders/loaders.
    createBookingScheduleExtension,
    createQuoteVersionSnapshotExtension: createOperatorQuoteVersionSnapshotExtension,
    loadBookingMaintenanceRoutes: async () => {
      const app = new Hono<{ Variables: { db: VoyantDb } }>()
      app.post("/:bookingId/rebuild-tax-lines", async (c) => {
        const bookingId = c.req.param("bookingId")
        try {
          const [
            { rebuildBookingItemTaxLines },
            { operatorPostgresDb },
            { resolveBookingTaxSettings: resolveTax },
          ] = await Promise.all([
            import("@voyant-travel/commerce/checkout"),
            import("./runtime/operator-runtime-adapter"),
            import("@voyant-travel/operator-settings"),
          ])
          const result = await rebuildBookingItemTaxLines(
            operatorPostgresDb(c.get("db")),
            bookingId,
            {
              resolveBookingTaxSettings: resolveTax,
            },
          )
          return c.json({ data: result })
        } catch (err) {
          return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
        }
      })
      return app
    },
    loadActionLedgerHealthRoutes: () =>
      import("./runtime/action-ledger-health-runtime").then((m) =>
        m.createActionLedgerHealthAdminRoutes(),
      ),
    loadProposalAdminRoutes: () =>
      import("./routes/proposal-routes").then((m) => m.createProposalAdminRoutes()),
    loadProposalPublicRoutes: () =>
      import("./routes/proposal-routes").then((m) => m.createProposalPublicRoutes()),
    loadCatalogOffersRoutes: () =>
      import("./runtime/catalog-offers-runtime").then((m) =>
        m.createCatalogOffersAdminRoutesForOperator(),
      ),
    loadCatalogCheckoutRoutes: () =>
      import("./routes/catalog-checkout").then((m) => m.createCatalogCheckoutPublicRoutes()),
  }
}

/**
 * The deployment-local module factories — the only two families that aren't
 * package-owned standard (Better-Auth team invitations + the operator's own
 * settings schema/routes). `createVoyantApp` merges these onto the standard
 * `frameworkComposition` set; `app.ts` passes them as `modules`.
 */
export const deploymentLocalModules: Record<string, ModuleFactory<OperatorCapabilities>> = {
  "operator/invitations": () => ({
    module: { name: "invitations" },
    lazyAdminRoutes: () =>
      import("./routes/invitations").then((m) => m.createInvitationsAdminRoutes()),
    lazyPublicRoutes: () =>
      import("./routes/invitations").then((m) => m.createInvitationsPublicRoutes()),
  }),
  "operator/operator-settings": () => ({
    module: { name: "operator-settings" },
    lazyRoutes: {
      paths: [
        "/v1/admin/settings/*",
        "/v1/public/operator-profile",
        "/v1/public/settings/operator",
      ],
      load: () =>
        import("./routes/settings").then((m) => {
          const app = new Hono()
          m.mountOperatorSettingsRoutes(app)
          return app
        }),
    },
  }),
}

/**
 * The full composed manifest + registry — DERIVED from the framework-owned
 * standard set plus the deployment-local additions. `app.ts` builds the app via
 * `createVoyantApp` (which assembles the same internally); these exports remain
 * for `voyant db doctor` parity inspection and the composition tests.
 */
export const OPERATOR_RUNTIME_MANIFEST = {
  modules: [...FRAMEWORK_RUNTIME_MANIFEST.modules, ...Object.keys(deploymentLocalModules)],
  extensions: [...FRAMEWORK_RUNTIME_MANIFEST.extensions],
} satisfies CompositionManifest

export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
  modules: { ...frameworkComposition.modules, ...deploymentLocalModules },
  extensions: { ...frameworkComposition.extensions },
}
