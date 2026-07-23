import { definePort } from "@voyant-travel/core/project"

export interface CatalogReindexProductsPage {
  afterId?: string
  limit: number
}

export interface CatalogReindexClaim {
  tenantId: string
  generation: number
  leaseOwner: string
  afterId?: string
  batches: number
  scanned: number
  indexed: number
  retries: number
}

export type CatalogReindexProgress =
  | {
      phase: "failure"
      tenantId: string
      generation: number
      productId: string
      attempts: number
      error: string
    }
  | {
      phase: "batch"
      tenantId: string
      generation: number
      batches: number
      scanned: number
      indexed: number
      retries: number
      afterId: string
    }
  | {
      phase: "complete"
      tenantId: string
      generation: number
      batches: number
      scanned: number
      indexed: number
      retries: number
    }

export interface CatalogReindexCheckpoint {
  afterId?: string
  batches: number
  scanned: number
  indexed: number
  retries: number
}

export interface CatalogReindexJobRuntime {
  requestGeneration(): Promise<number>
  claimWork(leaseOwner: string): Promise<CatalogReindexClaim | null>
  renewLease(claim: CatalogReindexClaim): Promise<boolean>
  checkpoint(claim: CatalogReindexClaim, checkpoint: CatalogReindexCheckpoint): Promise<boolean>
  complete(claim: CatalogReindexClaim, checkpoint: CatalogReindexCheckpoint): Promise<boolean>
  releaseLease(claim: CatalogReindexClaim): Promise<void>
  listProductIdsPage(input: CatalogReindexProductsPage): Promise<readonly string[]>
  reindexProduct(productId: string): Promise<void>
  reportProgress(progress: CatalogReindexProgress): void
  sleep?(milliseconds: number): Promise<void>
  createLeaseOwner?(): string
}

export interface CatalogReindexJobRuntimeProvider {
  createRuntime(bindings: unknown): CatalogReindexJobRuntime | Promise<CatalogReindexJobRuntime>
}

const RUNTIME_METHODS = [
  "requestGeneration",
  "claimWork",
  "renewLease",
  "checkpoint",
  "complete",
  "releaseLease",
  "listProductIdsPage",
  "reindexProduct",
  "reportProgress",
] as const

export const catalogReindexJobRuntimePort = definePort<CatalogReindexJobRuntimeProvider>({
  id: "catalog.reindex-products-job",
  test(provider) {
    if (!provider || typeof provider.createRuntime !== "function") {
      throw new Error("catalog.reindex-products-job provider must implement createRuntime().")
    }
  },
})

export function validateCatalogReindexJobRuntime(runtime: CatalogReindexJobRuntime): void {
  for (const method of RUNTIME_METHODS) {
    if (typeof runtime[method] !== "function") {
      throw new Error(`catalog.reindex-products-job runtime must implement ${method}().`)
    }
  }
}
