import type { EventBus, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { resolveNodeDatabase, withNodeDatabase } from "@voyant-travel/db/runtime"
import { enqueueGraphWebhookEvent } from "@voyant-travel/distribution"
import type { ResolveInvoiceExchangeRate } from "@voyant-travel/finance"
import type { VoyantDb } from "@voyant-travel/hono"
import {
  createOperatorDeploymentResources,
  type OperatorDeploymentResources,
} from "@voyant-travel/operator-runtime/deployment-resources"
import {
  createDocumentStorage,
  readDocumentContentBase64,
  resolveDocumentDownloadUrl,
} from "@voyant-travel/storage/runtime"
import {
  type CloudWorkflowsClientEnv,
  createCloudWorkflowDriver,
} from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { resolveOperatorCustomFields } from "../../lib/custom-fields"
import { resolveNotificationProviders } from "../../lib/notifications"
import { resolveVoyantDataApiKey } from "../../lib/voyant-cloud"

export function operatorBindings(bindings: unknown): AppBindings & Record<string, unknown> {
  return bindings as unknown as AppBindings & Record<string, unknown>
}

export function operatorPostgresDb(db: VoyantDb): PostgresJsDatabase {
  return db as PostgresJsDatabase
}

export function resolveOperatorDb(bindings: unknown) {
  return resolveNodeDatabase(operatorBindings(bindings))
}

export function readOperatorDocumentContentBase64(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  return readDocumentContentBase64(operatorBindings(bindings), storageKey)
}

export function resolveOperatorDocumentDownloadUrl(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  return resolveDocumentDownloadUrl(operatorBindings(bindings), storageKey)
}

export function createOperatorDocumentStorage(bindings: unknown) {
  return createDocumentStorage(operatorBindings(bindings))
}

/** Concrete Node resources injected into the generic Operator deployment host. */
export function createOperatorRuntimeHostPrimitives(): VoyantRuntimeHostPrimitives {
  return {
    env: (bindings) => operatorBindings(bindings),
    database: {
      resolve: <TDatabase>(bindings: unknown) =>
        resolveOperatorDb(bindings) as unknown as TDatabase,
      fromContext: <TDatabase>(context: unknown) =>
        operatorPostgresDb(
          (context as { get(key: string): Parameters<typeof operatorPostgresDb>[0] }).get("db"),
        ) as unknown as TDatabase,
      transaction: (bindings, operation) =>
        withNodeDatabase(operatorBindings(bindings), (database) => operation(database)),
    },
    storage: {
      resolve: createOperatorDocumentStorage,
      read: readOperatorDocumentContentBase64,
      downloadUrl: resolveOperatorDocumentDownloadUrl,
    },
    events: {
      deliver: (event, bindings) =>
        enqueueGraphWebhookEvent(
          resolveOperatorDb(bindings),
          event as Parameters<typeof enqueueGraphWebhookEvent>[1],
        ),
    },
    config: {
      read: (bindings, key) => {
        if (key === "customFields") return resolveOperatorCustomFields
        if (key === "notificationProviders") return resolveNotificationProviders
        return operatorBindings(bindings)?.[key]
      },
    },
  }
}

export function createOperatorRuntimeDeploymentResources(
  createGeneratedGraphRuntimePorts: (host: {
    primitives: VoyantRuntimeHostPrimitives
  }) => OperatorDeploymentResources["ports"],
): OperatorDeploymentResources {
  const primitives = createOperatorRuntimeHostPrimitives()
  const createRuntimePorts = ({ primitives }: { primitives: VoyantRuntimeHostPrimitives }) => {
    return createGeneratedGraphRuntimePorts({ primitives })
  }
  return createOperatorDeploymentResources({ primitives, createRuntimePorts })
}

export function createOperatorInvoiceExchangeRateResolver(bindings: unknown) {
  const env = operatorBindings(bindings)
  const apiKey = resolveVoyantDataApiKey(env)
  if (!apiKey) return undefined
  let resolver: ResolveInvoiceExchangeRate | undefined
  return async (input: Parameters<ResolveInvoiceExchangeRate>[0]) => {
    if (!resolver) {
      const { createVoyantDataFxExchangeRateResolver } = await import("@voyant-travel/finance")
      resolver = createVoyantDataFxExchangeRateResolver({
        apiKey,
        baseUrl: env.VOYANT_CLOUD_API_URL,
      })
    }
    return resolver(input)
  }
}

export function operatorWorkflowCloudEnv(env: AppBindings): CloudWorkflowsClientEnv {
  return {
    VOYANT_CLOUD_WORKFLOWS_URL: env.VOYANT_CLOUD_WORKFLOWS_URL,
    VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
    VOYANT_CLOUD_APP_SLUG: env.VOYANT_CLOUD_APP_SLUG ?? "operator",
    VOYANT_CLOUD_ENVIRONMENT: env.VOYANT_CLOUD_ENVIRONMENT,
  }
}

export function createOperatorWorkflowDriver(bindings: unknown) {
  const env = operatorBindings(bindings)
  // Use Voyant Cloud orchestration only when it's actually configured.
  // Local/self-hosted deployments (no Cloud workflow URL + trigger token) run
  // workflows fully in-process via the in-memory driver — no Cloud dependency.
  const cloudConfigured =
    Boolean(env.VOYANT_CLOUD_WORKFLOWS_URL?.trim()) &&
    Boolean(env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?.trim())
  if (cloudConfigured) {
    return () => createCloudWorkflowDriver({ env: operatorWorkflowCloudEnv(env) })
  }
  return createInMemoryDriver()
}

export async function generateContractPdfForBooking(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
  db: PostgresJsDatabase,
  eventBus: EventBus | undefined,
  bookingId: string,
  options: { force?: boolean } = {},
) {
  const runtime = await import("@voyant-travel/legal/runtime")
  return runtime.generateContractPdfForBooking(
    primitives,
    bindings,
    db,
    eventBus,
    bookingId,
    options,
  )
}
