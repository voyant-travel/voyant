import {
  BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY,
  type BookingsExpireStaleHoldsWorkflowRuntime,
} from "@voyant-travel/bookings/workflow-runtime"
import { createIndexerService } from "@voyant-travel/catalog"
import {
  CATALOG_DRAFT_REAPER_RUNTIME_KEY,
  type CatalogDraftReaperRuntime,
} from "@voyant-travel/catalog/draft-reaper-workflow"
import {
  PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY,
  type PromotionBoundarySchedulerRuntime,
} from "@voyant-travel/commerce/promotions/workflow-boundary-scheduler"
import { createContainer, type ModuleContainer } from "@voyant-travel/core"
import {
  CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
  type CruisesExternalRefreshWorkflowRuntime,
} from "@voyant-travel/cruises/external-refresh-workflow"
import { createDbClient } from "@voyant-travel/db"
import {
  EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
  type EventOutboxWorkflowRuntime,
} from "@voyant-travel/db/outbox-workflow"
import {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  type ChannelPushDeps,
} from "@voyant-travel/distribution/channel-push-runtime"
import {
  CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY,
  type ChannelPushReconcileWorkflowRuntime,
} from "@voyant-travel/distribution/channel-push-workflows"
import { closeTerminalBookingPaymentSchedules, financeService } from "@voyant-travel/finance"
import { paymentSessions } from "@voyant-travel/finance/schema"
import {
  createDefaultProductBrochureTemplate,
  loadProductBrochureTemplateContext,
  renderProductBrochureTemplate,
} from "@voyant-travel/inventory/tasks"
import {
  PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
  type ProductsGeneratePdfWorkflowRuntime,
} from "@voyant-travel/inventory/workflow-runtime"
import {
  NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
  type NotificationReminderWorkflowRuntime,
} from "@voyant-travel/notifications/workflow-runtime"
import { and, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { createProductBrochurePrinter } from "../../lib/brochure-printer.js"
import { getNotificationTaskRuntime } from "../../lib/notifications.js"
import { reportBackgroundFailure } from "../../lib/observability.js"
import { createBulkReindexProductsService } from "../lib/bulk-reindex-service.js"
import { ensureBookingEngineRegistry } from "../lib/booking-engine-runtime.js"
import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  getFieldPolicyRegistries,
  loadCatalogSlices,
  withEmbedding,
} from "../lib/catalog-runtime.js"
import { withDbFromEnv } from "../lib/db.js"
import { operatorPostgresDb } from "./operator-runtime-adapter.js"

export const OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS = {
  bookings: "@voyant-travel/bookings",
  cruises: "@voyant-travel/cruises",
  db: "@voyant-travel/db",
  distribution: "@voyant-travel/distribution#channel-push-extension",
  inventory: "@voyant-travel/inventory",
  notifications: "@voyant-travel/notifications",
} as const

type OperatorWorkflowBindings = AppBindings | NodeJS.ProcessEnv | Record<string, unknown>

export function registerBookingsWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const runtime: BookingsExpireStaleHoldsWorkflowRuntime = {
    resolveDb: () => createWorkflowDb(env),
    resolveRuntime: () => ({
      expirePaymentSessionsForBooking: async (db, bookingId) => {
        const staleSessions = await db
          .select({ id: paymentSessions.id })
          .from(paymentSessions)
          .where(
            and(
              eq(paymentSessions.bookingId, bookingId),
              inArray(paymentSessions.status, ["pending", "requires_redirect", "processing"]),
            ),
          )

        for (const session of staleSessions) {
          await financeService.expirePaymentSession(db, session.id, {
            notes: "Booking hold expired",
          })
        }
      },
      closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    }),
    userId: "system",
  }
  container.register(BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY, runtime)
}

export async function registerDistributionWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): Promise<void> {
  const env = workflowEnvironment(bindings)
  const appBindings = operatorBindings(bindings)
  const { ensureBookingEngineRegistry } = await import("../lib/booking-engine-runtime.js")
  const runtime: ChannelPushDeps = {
    db: createLazyWorkflowDb(() => createWorkflowDb(env)),
    registry: await ensureBookingEngineRegistry(env),
  }
  container.register(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, runtime)
  const reconcileRuntime: ChannelPushReconcileWorkflowRuntime = {
    withDeps: (operation) =>
      withDbFromEnv(appBindings, async (db) =>
        operation({ db, registry: await ensureBookingEngineRegistry(env) }),
      ),
  }
  container.register(CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY, reconcileRuntime)
}

export function registerInventoryWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const runtime: ProductsGeneratePdfWorkflowRuntime = {
    resolveDb: () => createWorkflowDb(env),
    render: async (db, input) => {
      const context = await loadProductBrochureTemplateContext(db, input.productId)
      const rendered = await renderProductBrochureTemplate(
        createDefaultProductBrochureTemplate(),
        context,
      )
      const printed = await createProductBrochurePrinter(env)({ template: rendered, context })
      return {
        base64: Buffer.from(printed.body).toString("base64"),
        filename: rendered.filename,
        sizeBytes: printed.fileSize ?? printed.body.byteLength,
      }
    },
  }
  container.register(PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY, runtime)
}

export function registerNotificationsWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  container.register(
    NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
    createNotificationsWorkflowRuntime(bindings),
  )
}

export function registerCruisesWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const appBindings = operatorBindings(bindings)
  const runtime: CruisesExternalRefreshWorkflowRuntime = {
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
        return operation({
          db,
          sourceAdapterRegistry: await ensureBookingEngineRegistry(env),
          indexerService,
          fieldPolicyRegistries: getFieldPolicyRegistries(),
          wrapCatalogBuilder: (builder) => withEmbedding(builder, embeddings),
          onCatalogProgress(event) {
            console.info("[external-cruise-refresh] catalog page", event)
          },
        })
      }),
  }
  container.register(CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY, runtime)
}

export function registerEventOutboxWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const appBindings = operatorBindings(bindings)
  const runtime: EventOutboxWorkflowRuntime = {
    withDb: (operation) => withDbFromEnv(appBindings, (db) => operation(operatorPostgresDb(db))),
    async resolveEventBus() {
      const { app } = await import("../app.js")
      await app.ready(appBindings)
      return app.eventBus
    },
    warn: (message) => console.warn(message),
  }
  container.register(EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY, runtime)
}

export function createNotificationsWorkflowRuntime(
  bindings: OperatorWorkflowBindings,
): NotificationReminderWorkflowRuntime {
  const env = workflowEnvironment(bindings)
  return {
    resolveDb: () => createWorkflowDb(env),
    resolveEnv: () => env,
    resolveRuntimeOptions: (runtimeEnv) => getNotificationTaskRuntime(runtimeEnv),
  }
}

export async function createOperatorWorkflowServiceResolver(
  bindings: OperatorWorkflowBindings,
  selectedUnitIds: ReadonlySet<string>,
): Promise<ModuleContainer> {
  const container = createContainer()
  registerCatalogDraftReaperWorkflowService(container, bindings)
  registerPromotionBoundaryWorkflowService(container, bindings)
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.bookings)) {
    registerBookingsWorkflowService(container, bindings)
  }
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.cruises)) {
    registerCruisesWorkflowService(container, bindings)
  }
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.db)) {
    registerEventOutboxWorkflowService(container, bindings)
  }
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.inventory)) {
    registerInventoryWorkflowService(container, bindings)
  }
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.notifications)) {
    registerNotificationsWorkflowService(container, bindings)
  }
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.distribution)) {
    await registerDistributionWorkflowService(container, bindings)
  }
  return container
}

function registerCatalogDraftReaperWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const runtime: CatalogDraftReaperRuntime = {
    withDb: (operation) => operation(createWorkflowDb(env)),
    resolveSourceRegistry: () =>
      import("../lib/booking-engine-runtime.js").then((module) =>
        module.ensureBookingEngineRegistry(env as AppBindings),
      ),
    resolveOwnedHandlers: () =>
      import("../lib/booking-engine-runtime.js").then((module) =>
        module.getOwnedBookingHandlerRegistry(env as AppBindings),
      ),
    reportFailure: (error, context) => reportBackgroundFailure("draft-reaper", error, context),
  }
  container.register(CATALOG_DRAFT_REAPER_RUNTIME_KEY, runtime)
}

function registerPromotionBoundaryWorkflowService(
  container: ModuleContainer,
  bindings: OperatorWorkflowBindings,
): void {
  const env = workflowEnvironment(bindings)
  const runtime: PromotionBoundarySchedulerRuntime = {
    withDb: (operation) => operation(createWorkflowDb(env)),
    createReindexService: () => createBulkReindexProductsService(env as AppBindings),
  }
  container.register(PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY, runtime)
}

export function createLazyWorkflowDb<TDb extends object = PostgresJsDatabase>(
  factory: () => TDb,
): TDb {
  let db: TDb | undefined
  const resolveDb = () => (db ??= factory())

  return new Proxy({} as TDb, {
    get(_target, prop) {
      const resolved = resolveDb()
      const value = Reflect.get(resolved as object, prop, resolved)
      return typeof value === "function" ? value.bind(resolved) : value
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolveDb() as object, prop)
    },
    has(_target, prop) {
      return prop in (resolveDb() as object)
    },
    ownKeys() {
      return Reflect.ownKeys(resolveDb() as object)
    },
  })
}

function createWorkflowDb(env: NodeJS.ProcessEnv): PostgresJsDatabase {
  if (!env.DATABASE_URL) throw new Error("Workflow runtime requires DATABASE_URL")
  return createDbClient(env.DATABASE_URL, { adapter: "node" }) as PostgresJsDatabase
}

function workflowEnvironment(bindings: OperatorWorkflowBindings): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === "string") env[key] = value
  }
  return env
}
