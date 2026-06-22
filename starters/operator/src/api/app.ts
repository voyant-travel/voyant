import { createVoyantApp } from "@voyant-travel/framework"
import { netopiaHonoBundle } from "@voyant-travel/plugin-netopia"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import { OPERATOR_APP_NAME, operatorReporter } from "../lib/observability"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import {
  buildOperatorProviders,
  deploymentLocalExtensions,
  deploymentLocalModules,
} from "./composition"
import { dbFromEnvForApp, httpDbFromEnvForApp } from "./lib/db"
import { bookingScheduleBundle } from "./routes/booking-schedule"
import { channelPushBundle } from "./routes/channel-push"
import {
  createOperatorWorkflowDriver,
  generateContractPdfForBooking,
} from "./runtime/operator-runtime-adapter"
import { tripsPaymentBundle } from "./runtime/trips-runtime"
import { catalogBridgeBundle } from "./subscribers/catalog-bridge"
import { createCatalogCheckoutBundle } from "./subscribers/catalog-checkout-finalize-runtime"
import { smartbillOperatorBundle } from "./subscribers/smartbill"

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

// The standard module/extension set is owned by @voyant-travel/framework;
// `createVoyantApp` assembles it (FRAMEWORK_RUNTIME_MANIFEST + frameworkComposition)
// with this deployment's injected `providers` and its two deployment-local module
// families (`deploymentLocalModules`), then composes + mounts. The deployment no
// longer hand-maintains a manifest or registry. See the consolidated-deployments
// RFC (Workstream B) + voyant#1608 / #1620.
export const app = createVoyantApp<CloudflareBindings, ReturnType<typeof buildOperatorProviders>>({
  providers: buildOperatorProviders(),
  modules: deploymentLocalModules,
  extensions: deploymentLocalExtensions,
  // Observability seam (RFC voyant#1553): stamp this app's name on emitted
  // error events and forward unhandled 5xx exceptions — each tagged with the
  // same `requestId` shown to the user on `X-Request-Id` — to the Workers log
  // drain. The same sink is wired into the lean auth app (api/auth/handler.ts),
  // which is dispatched around this graph. Swap `operatorReporter` for a
  // Sentry/OpenTelemetry adapter in one place; the no-op default stays valid.
  appName: OPERATOR_APP_NAME,
  reporter: operatorReporter,
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
    // Every domain + deployment-local route family is now composed through the
    // registry (see composition.ts). The only thing left here is the workflow-
    // runs admin surface, which is coupled to the app-level runner registry that
    // bundle bootstraps populate at construction time.

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
