import { actionLedgerHonoModule } from "@voyant-travel/action-ledger"
import { mountApp } from "@voyant-travel/hono/app"
import { identityHonoModule } from "@voyant-travel/identity"
import { createRelationshipsHonoModule } from "@voyant-travel/relationships"
import { sourceConnectionsHonoModule } from "@voyant-travel/source-connections"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"

import { FEDERATED_OPERATOR_APP_NAME, federatedOperatorReporter } from "@/lib/observability"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import { dbFromEnvForApp, httpDbFromEnvForApp } from "./lib/db"

const workflowRunnerRegistry = new WorkflowRunnerRegistry()

export const app = mountApp<CloudflareBindings>({
  modules: [
    actionLedgerHonoModule,
    createRelationshipsHonoModule(),
    identityHonoModule,
    sourceConnectionsHonoModule,
  ],
  appName: FEDERATED_OPERATOR_APP_NAME,
  reporter: federatedOperatorReporter,
  db: (env) =>
    env.DB_FORCE_TRANSACTIONAL === "1" ? dbFromEnvForApp(env) : httpDbFromEnvForApp(env),
  dbTransactional: (env) => dbFromEnvForApp(env),
  outbox: false,
  publicPaths: [],
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
    mountWorkflowRunsAdminRoutes(hono, {
      runners: workflowRunnerRegistry,
      resolveUserId: (c) => {
        const ctx = c as { get: (key: string) => unknown }
        const userId = ctx.get("userId")
        return typeof userId === "string" ? userId : null
      },
    })
  },
})
