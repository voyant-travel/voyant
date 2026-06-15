import { createApp } from "@voyant-travel/hono"
import { composeFromManifest } from "@voyant-travel/hono/composition"
import { netopiaHonoBundle } from "@voyant-travel/plugin-netopia"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import { bookingScheduleBundle } from "./booking-schedule"
import { catalogBridgeBundle } from "./catalog-bridge"
import { createCatalogCheckoutBundle } from "./catalog-checkout-finalize-runtime"
import { channelPushBundle } from "./channel-push"
import {
  buildOperatorCapabilities,
  OPERATOR_RUNTIME_MANIFEST,
  operatorComposition,
} from "./composition"
import { mountOperatorLazyAdditionalRoutes } from "./lazy-additional-routes"
import { mountLazyRouteApp } from "./lazy-route-app"
import { dbFromEnvForApp, httpDbFromEnvForApp } from "./lib/db"
import {
  createOperatorWorkflowDriver,
  generateContractPdfForBooking,
} from "./operator-runtime-adapter"
import { mountOperatorSettingsRoutes } from "./settings"
import { smartbillOperatorBundle } from "./smartbill"
import { tripsPaymentBundle } from "./trips-runtime"

/**
 * Process-wide registry of workflow runners. Bundles register their
 * runners on bootstrap (see `createCatalogCheckoutBundle`) so the
 * `/v1/admin/workflow-runs/:id/{rerun,resume}` endpoints can dispatch
 * a workflow by name. The dashboard's "Rerun" / "Resume" buttons are
 * powered by this registry. Self-hosted workflow services should
 * register runners that call `createSelfHostWorkflowClient(...)`
 * and forward resume calls with `ctx.resumeFromStep` and
 * `ctx.seedResults`.
 */
const workflowRunnerRegistry = new WorkflowRunnerRegistry()

// Runtime modules + extensions are DERIVED from the manifest via the
// composition registry (see ./composition.ts) rather than hand-listed here.
// Mount/hook order follows OPERATOR_RUNTIME_MANIFEST; capabilities (storage,
// FX, providers, document-download, CRM, …) are gathered in one typed
// container. `voyant db doctor` cross-checks the manifest against the registry
// and against voyant.config.ts. See voyant#1608 / #1620.
const { modules, extensions } = composeFromManifest(
  OPERATOR_RUNTIME_MANIFEST,
  operatorComposition,
  buildOperatorCapabilities(),
)

const catalogBookingRoutePaths = [
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

const catalogOfferRoutePaths = [
  "/v1/admin/catalog/package-offers",
  "/v1/admin/catalog/package-detail",
  "/v1/admin/catalog/package-search",
  "/v1/admin/catalog/departure-airports",
  "/v1/admin/catalog/cruise-price",
  "/v1/admin/catalog/cruise-sailing-pricing",
] as const

export const app = createApp<CloudflareBindings>({
  // Split data plane (perf, RFC voyant#1687 Phase 1.1):
  // - `db` (default): neon-http — one fetch per query, NO connection
  //   handshake. Serves all reads and single-statement writes.
  // - `dbTransactional`: per-request Neon WebSocket Pool — the only
  //   Workers-compatible client that supports db.transaction(). createApp
  //   routes it to the surfaces of modules/extensions declaring
  //   `requiresTransactionalDb`, plus `dbTransactionalPaths` below.
  // `DB_FORCE_TRANSACTIONAL=1` reverts to the WS client for ALL requests
  // (operational escape hatch if a transactional surface was missed).
  db: (env) =>
    env.DB_FORCE_TRANSACTIONAL === "1" ? dbFromEnvForApp(env) : httpDbFromEnvForApp(env),
  dbTransactional: (env) => dbFromEnvForApp(env),
  dbTransactionalPaths: [
    // Catalog booking engine (template-mounted at /v1/{admin,public}/catalog):
    // book/holds/orders reach bookings' reserve/release transactions through
    // the owned-product adapter; quote is included conservatively (the
    // quote-before-reserve path may touch holds). Search and browse stay
    // on the cheap default client.
    "/v1/admin/catalog/quote",
    "/v1/admin/catalog/book",
    "/v1/admin/catalog/holds",
    "/v1/admin/catalog/orders",
    "/v1/public/catalog/quote",
    "/v1/public/catalog/book",
    "/v1/public/catalog/holds",
    // Trips reserves trips via injected bookings deps.
    "/v1/admin/trips",
    "/v1/public/trips",
    "/v1/trips",
  ],
  // Workflow runtime — managed Cloud forwarding. App code forwards
  // trigger/event calls to Voyant Cloud; workflow bundles execute in the
  // hosted Node runtime.
  workflows: {
    driver: createOperatorWorkflowDriver,
  },
  // Durable event delivery (RFC voyant#1687 Phase 2.1): emits persist to
  // the event_outbox table before subscribers run; failed deliveries are
  // retried by the */2min drain cron in entry.ts. Requires migration
  // 0062 (event_outbox).
  outbox: true,
  publicPaths: [
    "/v1/public/customer-portal/contact-exists",
    "/v1/public/storefront-verification",
    "/v1/public/finance/bookings",
    "/v1/public/finance/collections",
    // Invitation redemption is reachable without a session.
    "/v1/public/invitations",
    // Payment-link landing page reads the session via TypeID (unguessable)
    // and the bank-transfer block from a config endpoint. Both must be
    // reachable without auth — the customer arrives from an emailed link.
    "/v1/public/finance/payment-sessions",
    // Accountant share portal — the token in the path is the bearer credential,
    // validated server-side per request; the accountant arrives via a shared link.
    "/v1/public/finance/accountant",
    "/v1/public/payment-link-config",
    "/v1/public/payment-link",
    // Customer-facing sent Quote Version proposal. This public route must
    // return only customer-safe DTO fields, never internal CRM rows.
    "/v1/public/proposals",
    // Storefront booking journey — quote / book / drafts run
    // unauthenticated against the customer surface. Per
    // booking-journey-architecture §10 Phase B (the journey is
    // auth-less or session-token-bound; this template takes the
    // auth-less posture and assigns `actor: "customer"`).
    "/v1/public/catalog",
    // Storefront post-card-payment status poll. The booking id is a
    // TypeID in the redirect URL; the response exposes only non-PII state.
    "/v1/public/bookings",
    // Storefront product / cruise / accommodations detail —
    // drives the `/shop/products/...` page's content fetch.
    "/v1/public/products",
    "/v1/public/cruises",
    "/v1/public/accommodations",
    // Storefront public CRM intake. Host deployments can wire captcha /
    // rate-limit checks through the storefront intake guard.
    "/v1/public/leads",
    "/v1/public/newsletter",
    // Storefront contract preview — the booking journey resolves the
    // active customer-scope template and renders its preview HTML
    // before the customer accepts. Both the slug-resolution lookup
    // and the by-slug preview render live under this prefix.
    "/v1/public/legal",
    "/v1/public/documents",
    // Operator profile + customer payment policy (sanitized subset).
    // The storefront contract preview reads operator name / address /
    // license + the deposit terms from here so it can render the
    // operator block and a deposit/balance schedule before the booking
    // exists.
    "/v1/public/operator-profile",
    // Cascade-aware policy resolver — storefront preview hits this
    // with `(entityModule, entityId)` + journey selections to get
    // the policy that will apply at booking time (supplier /
    // category / listing / operator default).
    "/v1/public/payment-policy",
    // Netopia webhook receiver. Netopia's servers POST here without a
    // session cookie or bearer; the plugin handler matches the inbound
    // payload to a payment session by orderID and validates the
    // processor's response shape. This is the URL set in
    // `NETOPIA_NOTIFY_URL`.
    "/v1/finance/providers/netopia/callback",
  ],
  modules,
  extensions,
  plugins: [
    // bookingScheduleBundle subscribes to booking.confirmed BEFORE
    // legal's auto-generate-contract subscriber so the rendered
    // contract reads the freshly-written deposit/balance rows.
    bookingScheduleBundle,
    catalogBridgeBundle,
    createCatalogCheckoutBundle({
      workflowRunnerRegistry,
      generateContractPdf: ({ env, db, eventBus, bookingId }) =>
        generateContractPdfForBooking(env, db, eventBus, bookingId),
    }),
    tripsPaymentBundle,
    smartbillOperatorBundle,
    channelPushBundle,
    netopiaHonoBundle(),
  ],
  auth: {
    handler: () => ({
      fetch: async (request, env, ctx) =>
        authHandler.fetch(request, env, ctx as ExecutionContext | undefined),
    }),
    resolve: async ({ request, env }) => resolveAuthRequest(request, env),
    hasPermission: async ({ request, env }) => hasAuthPermission(request, env),
    validateApiKey: async ({ env, db, apiKey }) => validateApiTokenAccess(env, db, apiKey),
  },
  additionalRoutes: (hono) => {
    // Admin-issued invitation flow (single-tenant sign-up is otherwise gated
    // at the Better Auth layer).
    mountLazyRouteApp(
      hono,
      [
        "/v1/admin/invitations",
        "/v1/admin/invitations/:id",
        "/v1/public/invitations/:token",
        "/v1/public/invitations/:token/redeem",
      ],
      () =>
        import("./invitations").then(
          (module) => (app) => app.route("/", module.createInvitationsRoutes()),
        ),
    )

    // Action ledger diagnostics. GET is read-only drift health; POST writes
    // a synthetic canary action and verifies the relay row is visible.
    mountLazyRouteApp(
      hono,
      ["/v1/admin/action-ledger/health", "/v1/admin/action-ledger/health/check"],
      () => import("./action-ledger-health").then((module) => module.mountActionLedgerHealthRoutes),
    )

    // Operator profile, payment instructions, and booking payment defaults.
    mountOperatorSettingsRoutes(hono)

    // Booking payment-schedule (admin regenerate + public policy preview)
    // and booking-tax preview are now composed extensions on the bookings
    // module — see composition.ts.

    // Rebuild `booking_item_tax_lines` from the catalog snapshot for a
    // booking. Repairs bookings created before the snapshot fallback in
    // `materializeBookingItemTaxLine` shipped — without this, invoices
    // generated from such bookings end up with 0 tax even though the
    // booking page shows the upstream tax from its catalog snapshot.
    // POST /v1/admin/bookings/:bookingId/rebuild-tax-lines
    hono.post("/v1/admin/bookings/:bookingId/rebuild-tax-lines", async (c) => {
      const bookingId = c.req.param("bookingId")
      try {
        const [{ rebuildBookingItemTaxLines }, { operatorPostgresDb }] = await Promise.all([
          import("./catalog-checkout-materialization"),
          import("./operator-runtime-adapter"),
        ])
        const result = await rebuildBookingItemTaxLines(operatorPostgresDb(c.get("db")), bookingId)
        return c.json({ data: result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 500)
      }
    })

    mountLazyRouteApp(
      hono,
      ["/v1/admin/bookings/:bookingId/generate-contract", "/v1/admin/documents/files/*"],
      () =>
        import("./contract-document-routes").then(
          (module) => module.mountOperatorContractDocumentRoutes,
        ),
    )

    mountLazyRouteApp(
      hono,
      [
        "/v1/admin/products/:id/brochure/generate",
        "/v1/uploads",
        "/v1/admin/uploads",
        "/v1/uploads/video",
        "/v1/admin/uploads/video",
        "/v1/media/*",
        "/v1/admin/media/*",
      ],
      () => import("./media-upload-routes").then((module) => module.mountOperatorMediaUploadRoutes),
    )

    mountLazyRouteApp(
      hono,
      [
        "/v1/admin/quote-versions/:quoteVersionId/send",
        "/v1/public/proposals/:quoteVersionId",
        "/v1/public/proposals/:quoteVersionId/accept",
        "/v1/public/proposals/:quoteVersionId/decline",
      ],
      () => import("./proposal-routes").then((module) => module.mountOperatorProposalRoutes),
    )

    // Quote-version snapshot is now a composed extension on the trips
    // module — see composition.ts.

    mountOperatorLazyAdditionalRoutes(hono)

    mountLazyRouteApp(hono, ["/v1/admin/mcp/tools/:tool"], () =>
      import("./mcp").then((module) => module.mountOperatorAgentToolRoutes),
    )
    mountLazyRouteApp(hono, catalogBookingRoutePaths, () =>
      import("./catalog-booking").then((module) => module.mountCatalogBookingRoutes),
    )
    mountLazyRouteApp(hono, ["/v1/public/catalog/checkout/start"], () =>
      import("./catalog-checkout").then((module) => module.mountCatalogCheckoutRoutes),
    )
    mountLazyRouteApp(
      hono,
      [
        "/v1/admin/products/:id/content",
        "/v1/public/products/:id/content",
        "/v1/admin/cruises/:id/content",
        "/v1/public/cruises/:id/content",
        "/v1/admin/accommodations/:id/content",
        "/v1/public/accommodations/:id/content",
      ],
      () => import("./catalog-content").then((module) => module.mountCatalogContentRoutes),
    )
    mountLazyRouteApp(hono, catalogOfferRoutePaths, () =>
      import("./catalog-offers").then((module) => module.mountCatalogOffersRoutes),
    )
    mountLazyRouteApp(hono, ["/v1/admin/flights/*"], () =>
      import("./flights").then((module) => module.mountFlightRoutes),
    )

    // Workflow runs admin surface — list/get + rerun/resume actions
    // feeding the standalone dashboard SPA in
    // apps/workflow-runs-dashboard. The registry is populated by
    // bundle bootstraps (e.g. catalog-checkout registers the
    // `checkout-finalize` runner).
    mountWorkflowRunsAdminRoutes(hono, {
      runners: workflowRunnerRegistry,
      resolveUserId: (c) => {
        // Hono Context — typed loosely so the package stays
        // transport-agnostic; pull the userId set by the auth
        // middleware. Returns null for runs triggered without an
        // active session (shouldn't happen on the admin surface).
        const ctx = c as { get: (key: string) => unknown }
        const userId = ctx.get("userId")
        return typeof userId === "string" ? userId : null
      },
    })
  },
})
