import type { InvoiceSettlementPoller, ResolveInvoiceExchangeRate } from "@voyant-travel/finance"
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
import type { generateContractPdfForBooking as generateContractPdfForBookingImpl } from "./contract-document-runtime"

export function operatorBindings(bindings: unknown): AppBindings {
  return bindings as AppBindings
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
  const env = operatorBindings(bindings)
  if (!createDocumentStorage(env)) return undefined

  const generator: NonNullable<
    ReturnType<typeof import("./contract-document-runtime").resolveContractDocumentGenerator>
  > = async (context) => {
    const { resolveContractDocumentGenerator } = await import("./contract-document-runtime")
    const resolved = resolveContractDocumentGenerator(env)
    if (!resolved) {
      throw new Error("Contract document generator is not configured")
    }
    return resolved(context)
  }
  return generator
}

export async function createOperatorBookingPiiService(bindings: unknown) {
  const env = operatorBindings(bindings)
  const { buildBookingRouteRuntime, createBookingPiiService } = await import(
    "@voyant-travel/bookings"
  )
  const runtime = buildBookingRouteRuntime(env)
  try {
    return createBookingPiiService({ kms: await runtime.getKmsProvider() })
  } catch {
    return null
  }
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

export function createOperatorInvoiceSettlementPollers(bindings: unknown) {
  const env = operatorBindings(bindings)
  if (!isSmartbillConfigured(env)) return {} as Record<string, InvoiceSettlementPoller>

  let poller: InvoiceSettlementPoller | undefined
  return {
    smartbill: async (context: Parameters<InvoiceSettlementPoller>[0]) => {
      if (!poller) {
        const { createSmartbillSettlementPollers } = await import("../subscribers/smartbill")
        poller = createSmartbillSettlementPollers(env).smartbill
      }
      if (!poller) {
        throw new Error("SmartBill settlement poller is not configured")
      }
      return poller(context)
    },
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
  ...args: Parameters<typeof generateContractPdfForBookingImpl>
): ReturnType<typeof generateContractPdfForBookingImpl> {
  const { generateContractPdfForBooking } = await import("./contract-document-runtime")
  return generateContractPdfForBooking(...args)
}

function isSmartbillConfigured(env: AppBindings) {
  return Boolean(
    nonEmpty(env.SMARTBILL_USERNAME) &&
      (nonEmpty(env.SMARTBILL_API_TOKEN) ?? nonEmpty(env.SMARTBILL_TOKEN)) &&
      nonEmpty(env.SMARTBILL_COMPANY_VAT_CODE) &&
      (nonEmpty(env.SMARTBILL_INVOICE_SERIES_NAME) ?? nonEmpty(env.SMARTBILL_SERIES_NAME)),
  )
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
