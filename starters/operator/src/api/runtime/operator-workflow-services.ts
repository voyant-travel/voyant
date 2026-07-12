import { createIndexerService } from "@voyant-travel/catalog"
import {
  CATALOG_DRAFT_REAPER_RUNTIME_KEY,
  createCatalogDraftReaperRuntime,
} from "@voyant-travel/catalog/draft-reaper-workflow"
import { requireCatalogRuntimeServices } from "@voyant-travel/catalog/runtime-contracts"
import type { ModuleContainer } from "@voyant-travel/core"
import {
  CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
  createCruisesExternalRefreshWorkflowRuntime,
} from "@voyant-travel/cruises/external-refresh-workflow"
import { createDbClient } from "@voyant-travel/db"
import {
  createEventOutboxWorkflowRuntime,
  EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
  resolveWorkflowEnvironment,
} from "@voyant-travel/db/outbox-workflow"
import {
  createNotificationReminderWorkflowRuntime,
  type NotificationReminderWorkflowRuntime,
} from "@voyant-travel/notifications/workflow-runtime"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { getNotificationTaskRuntime } from "../../lib/notifications.js"
import { reportBackgroundFailure } from "../../lib/observability.js"
import { withDbFromEnv } from "../lib/db.js"
import { operatorBindings, operatorPostgresDb } from "./operator-runtime-adapter.js"

type OperatorWorkflowBindings = AppBindings | NodeJS.ProcessEnv | Record<string, unknown>

function workflowEnvironment(bindings: OperatorWorkflowBindings): NodeJS.ProcessEnv {
  return resolveWorkflowEnvironment(operatorBindings(bindings), process.env)
}

/** Deployment adapter consumed by the Notifications package bootstrap. */
export function createNotificationsWorkflowRuntime(
  bindings: OperatorWorkflowBindings,
): NotificationReminderWorkflowRuntime {
  const env = workflowEnvironment(bindings)
  return createNotificationReminderWorkflowRuntime({
    resolveDb: () => createWorkflowDb(env),
    resolveEnv: () => env,
    resolveRuntimeOptions: (runtimeEnv) => getNotificationTaskRuntime(runtimeEnv),
  })
}

/** Reuse graph-bootstrapped package services and add deployment-only host adapters. */
export async function createOperatorWorkflowServiceResolver(
  bindings: OperatorWorkflowBindings,
  selectedUnitIds: ReadonlySet<string>,
): Promise<ModuleContainer> {
  const appBindings = operatorBindings(bindings)
  const env = workflowEnvironment(bindings)
  const { app } = await import("../app.js")
  await app.ready(appBindings)
  const catalogRuntime = requireCatalogRuntimeServices()

  app.services.register(
    CATALOG_DRAFT_REAPER_RUNTIME_KEY,
    createCatalogDraftReaperRuntime({
      withDb: (operation) => operation(createWorkflowDb(env)),
      resolveSourceRegistry: () => catalogRuntime.ensureSourceRegistry(appBindings),
      resolveOwnedHandlers: () => catalogRuntime.getOwnedHandlers(appBindings),
      reportFailure: (error, context) => reportBackgroundFailure("draft-reaper", error, context),
    }),
  )
  if (selectedUnitIds.has("@voyant-travel/cruises"))
    app.services.register(
      CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
      createCruisesExternalRefreshWorkflowRuntime({
        withOptions: (operation) =>
          withDbFromEnv(appBindings, async (rawDb) => {
            const db = operatorPostgresDb(rawDb)
            const embeddings = catalogRuntime.buildEmbeddingProvider(env)
            const indexer = catalogRuntime.buildTypesenseIndexer(env, embeddings)
            if (!indexer) return operation({ db })

            const indexerService = createIndexerService({
              adapter: indexer,
              slices: await catalogRuntime.loadSlices(rawDb),
              registries: catalogRuntime.fieldPolicyRegistries(),
            })
            await indexerService.ensureCollections()
            return operation({
              db,
              sourceAdapterRegistry: await catalogRuntime.ensureSourceRegistry(env),
              indexerService,
              fieldPolicyRegistries: catalogRuntime.fieldPolicyRegistries(),
              wrapCatalogBuilder: (builder) => catalogRuntime.withEmbedding(builder, embeddings),
              onCatalogProgress: (event) =>
                console.info("[external-cruise-refresh] catalog page", event),
            })
          }),
      }),
    )
  if (selectedUnitIds.has("@voyant-travel/db"))
    app.services.register(
      EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
      createEventOutboxWorkflowRuntime({
        withDb: (operation) =>
          withDbFromEnv(appBindings, (db) => operation(operatorPostgresDb(db))),
        resolveEventBus: async () => app.eventBus,
        warn: (message) => console.warn(message),
      }),
    )
  return app.services
}

function createWorkflowDb(env: NodeJS.ProcessEnv): PostgresJsDatabase {
  if (!env.DATABASE_URL) throw new Error("Workflow runtime requires DATABASE_URL")
  return createDbClient(env.DATABASE_URL, { adapter: "node" }) as PostgresJsDatabase
}
