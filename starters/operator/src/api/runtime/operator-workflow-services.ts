import {
  BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY,
  type BookingsExpireStaleHoldsWorkflowRuntime,
} from "@voyant-travel/bookings/workflow-runtime"
import { createContainer, type ModuleContainer } from "@voyant-travel/core"
import { createDbClient } from "@voyant-travel/db"
import {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  type ChannelPushDeps,
} from "@voyant-travel/distribution/channel-push-runtime"
import { financeService } from "@voyant-travel/finance"
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
import { closeTerminalBookingPaymentSchedules } from "../subscribers/booking-payment-cleanup.js"

export const OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS = {
  bookings: "@voyant-travel/bookings",
  distribution: "@voyant-travel/distribution#channel-push-extension",
  inventory: "@voyant-travel/inventory",
  notifications: "@voyant-travel/notifications",
} as const

type OperatorWorkflowBindings = AppBindings | NodeJS.ProcessEnv

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
  const { ensureBookingEngineRegistry } = await import("../lib/booking-engine-runtime.js")
  const runtime: ChannelPushDeps = {
    db: createLazyWorkflowDb(() => createWorkflowDb(env)),
    registry: await ensureBookingEngineRegistry(env),
  }
  container.register(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, runtime)
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
  const env = workflowEnvironment(bindings)
  const runtime: NotificationReminderWorkflowRuntime = {
    resolveDb: () => createWorkflowDb(env),
    resolveEnv: () => env,
    resolveRuntimeOptions: (runtimeEnv) => getNotificationTaskRuntime(runtimeEnv),
  }
  container.register(NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY, runtime)
}

export async function createOperatorWorkflowServiceResolver(
  bindings: OperatorWorkflowBindings,
  selectedUnitIds: ReadonlySet<string>,
): Promise<ModuleContainer> {
  const container = createContainer()
  if (selectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.bookings)) {
    registerBookingsWorkflowService(container, bindings)
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
