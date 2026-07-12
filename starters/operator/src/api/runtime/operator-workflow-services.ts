import { createIndexerService } from "@voyant-travel/catalog"
import {
  CATALOG_DRAFT_REAPER_RUNTIME_KEY,
  createCatalogDraftReaperRuntime,
} from "@voyant-travel/catalog/draft-reaper-workflow"
import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  getFieldPolicyRegistries,
  loadCatalogSlices,
  withEmbedding,
} from "@voyant-travel/catalog-node/standard-node/catalog-runtime"
import {
  PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY,
  type PromotionBoundarySchedulerRuntime,
} from "@voyant-travel/commerce/promotions/workflow-boundary-scheduler"
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
  createProductsGeneratePdfWorkflowRuntime,
  PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
} from "@voyant-travel/inventory/workflow-runtime"
import {
  createNotificationReminderWorkflowRuntime,
  type NotificationReminderWorkflowRuntime,
} from "@voyant-travel/notifications/workflow-runtime"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createProductBrochurePrinter } from "../../lib/brochure-printer.js"
import { getNotificationTaskRuntime } from "../../lib/notifications.js"
import { reportBackgroundFailure } from "../../lib/observability.js"
import { createBulkReindexProductsService } from "../lib/bulk-reindex-service.js"
import { withDbFromEnv } from "../lib/db.js"
import { operatorBindings, operatorPostgresDb } from "./operator-runtime-adapter.js"

type OperatorWorkflowBindings = AppBindings | NodeJS.ProcessEnv | Record<string, unknown>

function workflowEnvironment(bindings: OperatorWorkflowBindings): NodeJS.ProcessEnv {
  return resolveWorkflowEnvironment(bindings, process.env)
}

/** Deployment adapter consumed by the Inventory package bootstrap. */
export function registerInventoryWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  container.register(
    PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
    createProductsGeneratePdfWorkflowRuntime({
      resolveDb: () => createWorkflowDb(env),
      resolvePrinter: () => createProductBrochurePrinter(env),
    }),
  )
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

  app.services.register(
    CATALOG_DRAFT_REAPER_RUNTIME_KEY,
    createCatalogDraftReaperRuntime({
      withDb: (operation) => operation(createWorkflowDb(env)),
      resolveSourceRegistry: () =>
        import("@voyant-travel/catalog-node/standard-node/booking-engine-runtime").then((runtime) =>
          runtime.ensureBookingEngineRegistry(appBindings),
        ),
      resolveOwnedHandlers: () =>
        import("@voyant-travel/catalog-node/standard-node/booking-engine-runtime").then((runtime) =>
          runtime.getOwnedBookingHandlerRegistry(appBindings),
        ),
      reportFailure: (error, context) => reportBackgroundFailure("draft-reaper", error, context),
    }),
  )
  app.services.register(PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY, {
    withDb: (operation) => operation(createWorkflowDb(env)),
    createReindexService: () => createBulkReindexProductsService(appBindings),
  } satisfies PromotionBoundarySchedulerRuntime)
  if (selectedUnitIds.has("@voyant-travel/cruises"))
    app.services.register(
      CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
      createCruisesExternalRefreshWorkflowRuntime({
        withOptions: (operation) =>
          withDbFromEnv(appBindings, async (rawDb) => {
            const db = operatorPostgresDb(rawDb)
            const embeddings = buildEmbeddingProvider(env)
            const indexer = buildTypesenseIndexer(env, embeddings)
            if (!indexer) return operation({ db })

            const indexerService = createIndexerService({
              adapter: indexer,
              slices: await loadCatalogSlices(rawDb),
              registries: getFieldPolicyRegistries(),
            })
            await indexerService.ensureCollections()
            const { ensureBookingEngineRegistry } = await import(
              "@voyant-travel/catalog-node/standard-node/booking-engine-runtime"
            )
            return operation({
              db,
              sourceAdapterRegistry: await ensureBookingEngineRegistry(env),
              indexerService,
              fieldPolicyRegistries: getFieldPolicyRegistries(),
              wrapCatalogBuilder: (builder) => withEmbedding(builder, embeddings),
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
