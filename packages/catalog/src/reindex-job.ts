import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import {
  type CatalogReindexCheckpoint,
  type CatalogReindexJobRuntime,
  catalogReindexJobRuntimePort,
  validateCatalogReindexJobRuntime,
} from "./reindex-job-runtime-port.js"

export {
  type CatalogReindexJobRuntime,
  type CatalogReindexJobRuntimeProvider,
  type CatalogReindexProgress,
  catalogReindexJobRuntimePort,
} from "./reindex-job-runtime-port.js"

export const CATALOG_REINDEX_BATCH_SIZE = 100
export const CATALOG_REINDEX_MAX_ATTEMPTS = 3
export const CATALOG_REINDEX_HEARTBEAT_MS = 30_000
const INITIAL_RETRY_DELAY_MS = 250

export interface CatalogReindexResult extends CatalogReindexCheckpoint {
  tenantId: string
  generation: number
}

export class CatalogReindexError extends Error {
  constructor(
    readonly result: CatalogReindexResult,
    readonly productId: string,
  ) {
    super(
      `Catalog product reindex failed for ${productId} in tenant ${result.tenantId} generation ${result.generation}.`,
    )
    this.name = "CatalogReindexError"
  }
}

/**
 * Persist one coalescing reindex generation, then drain it under a durable
 * tenant-scoped lease. Host retries and duplicate wakeups resume the same
 * checkpoint instead of starting competing full scans.
 */
export async function runCatalogReindexProductsJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  if (!context.bindings || typeof context.bindings !== "object") {
    throw new Error("Catalog product reindex requires concrete deployment job bindings.")
  }
  const provider = await context.getPort(catalogReindexJobRuntimePort)
  const runtime = await provider.createRuntime(context.bindings)
  validateCatalogReindexJobRuntime(runtime)
  await runtime.requestGeneration()
  await runCatalogReindexProducts(runtime)
}

export async function runCatalogReindexProducts(
  runtime: CatalogReindexJobRuntime,
): Promise<CatalogReindexResult | null> {
  const leaseOwner = runtime.createLeaseOwner?.() ?? crypto.randomUUID()
  const claim = await runtime.claimWork(leaseOwner)
  if (!claim) return null

  let leaseLost = false
  let renewal = Promise.resolve()
  const renew = () => {
    renewal = renewal
      .then(async () => {
        if (!(await runtime.renewLease(claim))) leaseLost = true
      })
      .catch(() => {
        leaseLost = true
      })
  }
  const heartbeat = setInterval(renew, CATALOG_REINDEX_HEARTBEAT_MS)
  heartbeat.unref?.()
  let heartbeatStopped = false
  const stopHeartbeat = () => {
    if (heartbeatStopped) return
    heartbeatStopped = true
    clearInterval(heartbeat)
  }

  const result: CatalogReindexResult = {
    tenantId: claim.tenantId,
    generation: claim.generation,
    ...(claim.afterId ? { afterId: claim.afterId } : {}),
    batches: claim.batches,
    scanned: claim.scanned,
    indexed: claim.indexed,
    retries: claim.retries,
  }

  try {
    let afterId = claim.afterId
    while (true) {
      assertLease(leaseLost)
      const productIds = await runtime.listProductIdsPage({
        afterId,
        limit: CATALOG_REINDEX_BATCH_SIZE,
      })
      if (productIds.length === 0) break

      let lastIndexedId = afterId
      for (const productId of productIds) {
        assertLease(leaseLost)
        result.scanned++
        const attempt = await reindexWithRetry(runtime, productId, result)
        if (!attempt.ok) {
          runtime.reportProgress({
            phase: "failure",
            tenantId: claim.tenantId,
            generation: claim.generation,
            productId,
            attempts: CATALOG_REINDEX_MAX_ATTEMPTS,
            error: errorMessage(attempt.error),
          })
          throw new CatalogReindexError(result, productId)
        }
        result.indexed++
        lastIndexedId = productId
      }

      if (!lastIndexedId) break
      afterId = lastIndexedId
      result.afterId = afterId
      result.batches++
      const checkpoint = checkpointFrom(result, afterId)
      if (!(await runtime.checkpoint(claim, checkpoint))) leaseLost = true
      assertLease(leaseLost)
      runtime.reportProgress({
        phase: "batch",
        tenantId: claim.tenantId,
        generation: claim.generation,
        ...checkpoint,
        afterId,
      })
      if (productIds.length < CATALOG_REINDEX_BATCH_SIZE) break
    }

    stopHeartbeat()
    await renewal
    assertLease(leaseLost)
    const checkpoint = checkpointFrom(result, result.afterId)
    if (!(await runtime.complete(claim, checkpoint))) leaseLost = true
    assertLease(leaseLost)
    runtime.reportProgress({
      phase: "complete",
      tenantId: claim.tenantId,
      generation: claim.generation,
      batches: result.batches,
      scanned: result.scanned,
      indexed: result.indexed,
      retries: result.retries,
    })
    return result
  } catch (error) {
    stopHeartbeat()
    await runtime.releaseLease(claim)
    throw error
  } finally {
    stopHeartbeat()
    await renewal
  }
}

async function reindexWithRetry(
  runtime: CatalogReindexJobRuntime,
  productId: string,
  result: CatalogReindexResult,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let delay = INITIAL_RETRY_DELAY_MS
  for (let attempt = 1; attempt <= CATALOG_REINDEX_MAX_ATTEMPTS; attempt++) {
    try {
      await runtime.reindexProduct(productId)
      return { ok: true }
    } catch (error) {
      if (attempt === CATALOG_REINDEX_MAX_ATTEMPTS) return { ok: false, error }
      result.retries++
      await (runtime.sleep ?? defaultSleep)(delay)
      delay *= 2
    }
  }
  return {
    ok: false,
    error: new Error(`Catalog reindex attempts exhausted for ${productId}.`),
  }
}

function checkpointFrom(
  result: CatalogReindexResult,
  afterId: string | undefined,
): CatalogReindexCheckpoint {
  return {
    ...(afterId ? { afterId } : {}),
    batches: result.batches,
    scanned: result.scanned,
    indexed: result.indexed,
    retries: result.retries,
  }
}

function assertLease(leaseLost: boolean): void {
  if (leaseLost) throw new Error("Catalog product reindex lease was lost before completion.")
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
