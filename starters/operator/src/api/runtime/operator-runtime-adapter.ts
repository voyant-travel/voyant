import type { EventBus, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { ResolveInvoiceExchangeRate } from "@voyant-travel/finance"
import type { VoyantDb } from "@voyant-travel/hono"
import {
  type CloudWorkflowsClientEnv,
  createCloudWorkflowDriver,
} from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { resolveVoyantDataApiKey } from "../../lib/voyant-cloud"
import { getDbFromEnv } from "../lib/db"
import {
  createDocumentStorage,
  readDocumentContentBase64,
  resolveDocumentDownloadUrl,
} from "../lib/storage"

export function operatorBindings(bindings: unknown): AppBindings & Record<string, unknown> {
  return bindings as unknown as AppBindings & Record<string, unknown>
}

export function operatorPostgresDb(db: VoyantDb): PostgresJsDatabase {
  return db as PostgresJsDatabase
}

export function resolveOperatorDb(bindings: unknown) {
  return getDbFromEnv(operatorBindings(bindings))
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
