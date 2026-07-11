import { BULK_REINDEX_SERVICE_KEY } from "@voyant-travel/commerce"
import { enqueueGraphWebhookEvent } from "@voyant-travel/distribution"
import {
  composeVoyantGraphRuntime,
  lowerVoyantGraphActionsToActionLedgerRegistry,
} from "@voyant-travel/framework"
import { mountApp } from "@voyant-travel/hono"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import { createGeneratedGraphRuntime } from "../../.voyant/runtime/graph-runtime.generated"
import { projectLinks } from "../../.voyant/runtime/project-links.generated"
import { OPERATOR_APP_NAME, operatorReporter } from "../lib/observability"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import {
  buildOperatorProviders,
  buildOperatorRuntimePorts,
  operatorGraphRuntimeBindings,
} from "./composition"
import { dbFromEnvForApp, httpDbFromEnvForApp } from "./lib/db"
import {
  createOperatorWorkflowDriver,
  generateContractPdfForBooking,
  resolveOperatorDb,
} from "./runtime/operator-runtime-adapter"
import { catalogBridgeBundle } from "./subscribers/catalog-bridge-bundle"
import { createCatalogCheckoutBundle } from "./subscribers/catalog-checkout-finalize-runtime"

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

const operatorProviders = buildOperatorProviders()
const graphRuntime = createGeneratedGraphRuntime()
export const operatorActionLedgerCapabilityRegistry =
  lowerVoyantGraphActionsToActionLedgerRegistry(graphRuntime)
const graphComposition = await composeVoyantGraphRuntime({
  runtime: graphRuntime,
  capabilities: operatorProviders,
  bindings: operatorGraphRuntimeBindings,
  ports: buildOperatorRuntimePorts(),
  outboundWebhooks: {
    enqueue: (event, bindings) => enqueueGraphWebhookEvent(resolveOperatorDb(bindings), event),
  },
})

export const app = mountApp<AppBindings>({
  modules: graphComposition.modules,
  extensions: graphComposition.extensions,
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
  //   routes it to the absolute transactional surface derived from the selected
  //   deployment graph (ADR-0008), so this deployment does not hand-maintain
  //   first-party transactional route families.
  // `DB_FORCE_TRANSACTIONAL=1` reverts to the WS client for ALL requests
  // (operational escape hatch if a transactional surface was missed).
  db: (env) =>
    env.DB_FORCE_TRANSACTIONAL === "1" ? dbFromEnvForApp(env) : httpDbFromEnvForApp(env),
  dbTransactional: (env) => dbFromEnvForApp(env),
  dbTransactionalPaths: [...graphComposition.routePosture.transactionalPaths],
  linkDefinitions: projectLinks,
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
  // Package-owned anonymous posture comes from the selected graph.
  publicPaths: [...graphComposition.routePosture.publicPaths],
  plugins: [
    {
      name: "operator-promotions-runtime",
      bootstrap: async ({ bindings, container }) => {
        const { createBulkReindexProductsService } = await import("./lib/bulk-reindex-service")
        container.register(
          BULK_REINDEX_SERVICE_KEY,
          createBulkReindexProductsService(bindings as AppBindings),
        )
      },
    },
    catalogBridgeBundle,
    createCatalogCheckoutBundle({
      workflowRunnerRegistry,
      generateContractPdf: ({ env, db, eventBus, bookingId, force }) =>
        generateContractPdfForBooking(env, db, eventBus, bookingId, { force }),
    }),
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
    // feeding the `WorkflowRunsPage` UI from
    // `@voyant-travel/workflows-react/ui`. The registry is populated by
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
