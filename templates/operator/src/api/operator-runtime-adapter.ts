import { createVoyantDataFxExchangeRateResolver } from "@voyantjs/finance"
import type { VoyantDb } from "@voyantjs/hono"
import { createCloudflareEdgeDriver } from "@voyantjs/workflows-orchestrator-cloudflare"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  generateContractPdfForBooking,
  resolveContractDocumentGenerator,
} from "./contract-document-runtime"
import { getDbFromEnv } from "./lib/db"
import {
  createDocumentStorage,
  readDocumentContentBase64,
  resolveDocumentDownloadUrl,
} from "./lib/storage"
import { createSmartbillSettlementPollers } from "./smartbill"

export function operatorBindings(bindings: unknown): CloudflareBindings {
  return bindings as CloudflareBindings
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

export function resolveOperatorContractDocumentGenerator(bindings: unknown) {
  return resolveContractDocumentGenerator(operatorBindings(bindings)) ?? undefined
}

export function createOperatorInvoiceExchangeRateResolver(bindings: unknown) {
  const env = operatorBindings(bindings)
  return createVoyantDataFxExchangeRateResolver({
    apiKey: env.VOYANT_CLOUD_API_KEY,
    baseUrl: env.VOYANT_CLOUD_API_URL,
  })
}

export function createOperatorInvoiceSettlementPollers(bindings: unknown) {
  return createSmartbillSettlementPollers(operatorBindings(bindings))
}

export function createOperatorWorkflowDriver(bindings: unknown) {
  const env = operatorBindings(bindings)
  return createCloudflareEdgeDriver({
    orchestratorNamespace: env.WORKFLOW_RUN_DO,
    manifestKv: env.WORKFLOW_MANIFESTS,
  })
}

export { generateContractPdfForBooking }
