/**
 * Manifest-driven runtime composition for the operator starter.
 *
 * agent-quality: file-size exception -- this is the deployment's single
 * composition source of truth (one factory entry per mounted module/extension,
 * now that every route family composes here instead of ad-hoc additionalRoutes).
 * Keeping the manifest + registry + capabilities in one file is intentional; the
 * length scales with the module count, not with logic complexity.
 *
 * Instead of hand-listing `createApp({ modules, extensions })`, `app.ts`
 * derives those arrays from this registry via
 * `composeFromManifest(manifest, registry, capabilities)`
 * (`@voyant-travel/hono/composition`). This is the runtime half of the
 * migration-resilience work (voyant#1608 / #1620): the manifest is the source
 * of truth, capabilities are gathered in one typed container, and each entry
 * maps to a factory.
 *
 * `OPERATOR_RUNTIME_MANIFEST` is the ordered runtime module/extension list —
 * mount + hook-registration order is significant, so it mirrors the previous
 * hand-written array order exactly. `voyant db doctor` cross-checks it against
 * `voyant.config.ts` (the schema manifest).
 */

import {
  FRAMEWORK_RUNTIME_MANIFEST,
  type FrameworkProviders,
  frameworkComposition,
} from "@voyant-travel/framework"
import type { VoyantDb } from "@voyant-travel/hono"
import type { CompositionManifest, CompositionRegistry } from "@voyant-travel/hono/composition"
import { CONTRACT_DOCUMENT_ROUTE_PATHS } from "@voyant-travel/legal"
import { createNetopiaCheckoutStarter } from "@voyant-travel/plugin-netopia"
import { relationshipsService } from "@voyant-travel/relationships"
import { Hono } from "hono"

import { resolveNotificationProviders } from "../lib/notifications"
import { resolveBookingRequirementsProductSnapshot } from "./lib/booking-requirements-product-snapshot"
import { buildCatalogContext } from "./lib/catalog-context"
import { createBookingScheduleExtension } from "./routes/booking-schedule"
import { createChannelPushExtension } from "./routes/channel-push"
import { createOperatorQuoteVersionSnapshotExtension } from "./routes/quote-version-snapshot-routes"
import { resolveBookingTaxSettings, updateBookingTaxSettings } from "./routes/settings"
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

/** Explicit matchers for the catalog booking-engine + order/snapshot routes. */
const OPERATOR_CATALOG_BOOKING_ROUTE_PATHS = [
  "/v1/admin/catalog/quote",
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
  "/v1/public/catalog/book",
  "/v1/public/catalog/drafts/:id",
  "/v1/public/catalog/holds/place",
  "/v1/public/catalog/holds/release",
  "/v1/public/catalog/slots",
] as const

/**
 * The operator deployment's capability container. Every template-specific
 * resolver/service a module factory needs is gathered here so wiring lives in
 * one typed place rather than being threaded through `createApp`.
 */
// `extends FrameworkProviders` is the compile-time guard that this container
// satisfies the framework's injected provider contract (so the relocated
// `frameworkComposition` factories can read it). A future framework provider
// addition becomes required here, failing the operator typecheck until
// `buildOperatorCapabilities` wires it — that's the intended forcing function.
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

/** Build the operator capability container (gathers deployment resolvers). */
export function buildOperatorCapabilities(): OperatorCapabilities {
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
    resolveBookingTaxSettings,
    updateBookingTaxSettings,
    createChannelPushExtension,
  }
}

/**
 * Ordered runtime composition — module/extension specifiers in mount order.
 * Keep in sync with `voyant.config.ts`; `voyant db doctor` enforces parity for
 * the schema-bearing subset.
 */
// The STANDARD package modules/extensions + their order are owned by
// @voyant-travel/framework (FRAMEWORK_RUNTIME_MANIFEST). This deployment spreads
// that and appends only its deployment-local families (the `operator/*` entries
// — see operator-registry-classification.md). Adding a standard module to the
// framework auto-joins it here; no re-listing.
export const OPERATOR_RUNTIME_MANIFEST = {
  modules: [
    ...FRAMEWORK_RUNTIME_MANIFEST.modules,
    "operator/mcp",
    "operator/invitations",
    "operator/catalog-booking",
    "operator/catalog-content",
    "operator/media",
    "operator/payment-link",
    "operator/operator-settings",
    "operator/contract-document",
  ],
  extensions: [
    ...FRAMEWORK_RUNTIME_MANIFEST.extensions,
    "operator/booking-schedule-extension",
    "operator/quote-version-snapshot-extension",
    "operator/booking-maintenance-extension",
    "operator/action-ledger-health-extension",
    "operator/proposal-extension",
    "operator/catalog-offers-extension",
    "operator/catalog-checkout-extension",
  ],
} satisfies CompositionManifest

/** Factory registry keyed by the manifest specifiers above. */
export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
  modules: {
    // Standard package modules owned by @voyant-travel/framework (Workstream B).
    // The framework's pure singleton factories spread in here; the deployment
    // appends only its capability-shaped + deployment-local factories below.
    ...frameworkComposition.modules,
    // Deployment-local route modules. The route bundles live in the operator
    // (vendor/demo wiring, agent tooling, Better Auth invitations) and load
    // lazily; the framework mounts + caches them and bridges request context.
    "@voyant-travel/flights": () => ({
      module: { name: "flights" },
      // Routes live in @voyant-travel/flights; this deployment supplies the
      // connector + payment options via ./flights-runtime.
      lazyAdminRoutes: () =>
        import("./runtime/flights-runtime").then((m) => m.buildFlightAdminRoutes()),
    }),
    "operator/mcp": () => ({
      module: { name: "mcp" },
      // Route + trips tools live in @voyant-travel/trips/mcp; this deployment
      // supplies the tool context + trips service wiring via ./mcp-runtime.
      lazyAdminRoutes: () => import("./runtime/mcp-runtime").then((m) => m.buildMcpAdminRoutes()),
    }),
    "operator/invitations": () => ({
      module: { name: "invitations" },
      lazyAdminRoutes: () =>
        import("./routes/invitations").then((m) => m.createInvitationsAdminRoutes()),
      lazyPublicRoutes: () =>
        import("./routes/invitations").then((m) => m.createInvitationsPublicRoutes()),
    }),
    // Multi-prefix deployment-local families: the route bundles span several
    // absolute prefixes, so they compose via `lazyRoutes` (explicit paths +
    // context bridging) over their existing absolute-route mount functions.
    "operator/catalog-booking": () => ({
      module: { name: "catalog-booking" },
      lazyRoutes: {
        paths: OPERATOR_CATALOG_BOOKING_ROUTE_PATHS,
        load: () =>
          import("./runtime/catalog-booking-runtime").then((m) => {
            const app = new Hono()
            m.mountCatalogBookingRoutes(app)
            return app
          }),
      },
    }),
    "operator/catalog-content": () => ({
      module: { name: "catalog-content" },
      lazyRoutes: {
        paths: [
          "/v1/admin/products/:id/content",
          "/v1/public/products/:id/content",
          "/v1/admin/cruises/:id/content",
          "/v1/public/cruises/:id/content",
          "/v1/admin/accommodations/:id/content",
          "/v1/public/accommodations/:id/content",
        ],
        load: () =>
          import("./routes/catalog-content").then((m) => {
            const app = new Hono()
            m.mountCatalogContentRoutes(app)
            return app
          }),
      },
    }),
    "operator/media": () => ({
      module: { name: "media" },
      lazyRoutes: {
        paths: [
          "/v1/admin/products/:id/brochure/generate",
          "/v1/uploads",
          "/v1/admin/uploads",
          "/v1/uploads/video",
          "/v1/admin/uploads/video",
          "/v1/media/*",
          "/v1/admin/media/*",
        ],
        load: () => import("./runtime/media-runtime").then((m) => m.buildOperatorMediaRoutes()),
      },
    }),
    "operator/payment-link": () => ({
      module: { name: "payment-link" },
      lazyRoutes: {
        paths: [
          "/v1/public/payment-link-config",
          "/v1/public/payment-link/:sessionId/retry",
          "/v1/public/payment-link/resolve",
          "/v1/public/payment-link/:sessionId/start-card",
          "/v1/public/payment-link/:sessionId/trip-summary",
          "/v1/public/payment-link/:sessionId/booking-summary",
          "/v1/public/bookings/:bookingId/checkout-status",
        ],
        load: () =>
          import("./runtime/payment-link-runtime").then((m) => m.buildOperatorPaymentLinkRoutes()),
      },
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
    "operator/contract-document": () => ({
      module: { name: "contract-document" },
      // Routes live in @voyant-travel/legal; this deployment supplies the
      // generator/preview + document storage via ./contract-document-runtime.
      lazyRoutes: {
        paths: CONTRACT_DOCUMENT_ROUTE_PATHS,
        load: () =>
          import("./runtime/contract-document-runtime").then((m) =>
            m.buildContractDocumentRoutes(),
          ),
      },
    }),
  },
  extensions: {
    // Standard package extensions owned by @voyant-travel/framework (Workstream
    // B, Tier 3). The deployment appends only its injection-shaped + local ones.
    ...frameworkComposition.extensions,
    "operator/booking-schedule-extension": () => createBookingScheduleExtension(),
    "operator/quote-version-snapshot-extension": () =>
      createOperatorQuoteVersionSnapshotExtension(),
    // Booking tax-line repair (single maintenance route on the bookings surface).
    "operator/booking-maintenance-extension": () => ({
      extension: { name: "booking-maintenance", module: "bookings" },
      lazyAdminRoutes: async () => {
        const app = new Hono<{ Variables: { db: VoyantDb } }>()
        app.post("/:bookingId/rebuild-tax-lines", async (c) => {
          const bookingId = c.req.param("bookingId")
          try {
            const [
              { rebuildBookingItemTaxLines },
              { operatorPostgresDb },
              { resolveBookingTaxSettings },
            ] = await Promise.all([
              import("@voyant-travel/commerce/checkout"),
              import("./runtime/operator-runtime-adapter"),
              import("./routes/settings"),
            ])
            const result = await rebuildBookingItemTaxLines(
              operatorPostgresDb(c.get("db")),
              bookingId,
              { resolveBookingTaxSettings },
            )
            return c.json({ data: result })
          } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
          }
        })
        return app
      },
    }),
    "operator/action-ledger-health-extension": () => ({
      extension: { name: "action-ledger-health", module: "action-ledger" },
      lazyAdminRoutes: () =>
        import("./runtime/action-ledger-health-runtime").then((m) =>
          m.createActionLedgerHealthAdminRoutes(),
        ),
    }),
    // Quote-version proposal lifecycle: admin send under /v1/admin/quote-versions,
    // public accept/decline under /v1/public/proposals.
    "operator/proposal-extension": () => ({
      extension: { name: "proposal", module: "quote-versions" },
      publicPath: "proposals",
      lazyAdminRoutes: () =>
        import("./routes/proposal-routes").then((m) => m.createProposalAdminRoutes()),
      lazyPublicRoutes: () =>
        import("./routes/proposal-routes").then((m) => m.createProposalPublicRoutes()),
    }),
    // Catalog admin offer/search + public checkout, mounted under the catalog
    // module's /v1/admin/catalog and /v1/public/catalog surfaces.
    "operator/catalog-offers-extension": () => ({
      extension: { name: "catalog-offers", module: "catalog" },
      lazyAdminRoutes: () =>
        import("./runtime/catalog-offers-runtime").then((m) =>
          m.createCatalogOffersAdminRoutesForOperator(),
        ),
    }),
    "operator/catalog-checkout-extension": () => ({
      extension: { name: "catalog-checkout", module: "catalog" },
      lazyPublicRoutes: () =>
        import("./routes/catalog-checkout").then((m) => m.createCatalogCheckoutPublicRoutes()),
    }),
  },
}
