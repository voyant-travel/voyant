import type {
  IndexerAdapter,
  IndexerDocument,
  IndexerSlice,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import type { IndexerService } from "../services/indexer-service.js"

export interface IndexerReconciliationTarget {
  /** A configured slice whose complete expected document set is supplied. */
  slice: IndexerSlice
  /** Creates a fresh document stream for every reconciliation attempt. */
  loadDocuments(): AsyncIterable<IndexerDocument> | Iterable<IndexerDocument>
}

export interface IndexerReconciliationOwnership {
  /** Whether this reconciliation owns the entire lifecycle of a slice. */
  ownsSlice(slice: IndexerSlice): boolean
  /** Whether an indexed document may be deleted when it is not expected. */
  ownsDocument(slice: IndexerSlice, document: IndexerDocument): boolean
}

export interface ReconcileIndexerOptions {
  /** The service and adapter must describe the same configured indexer. */
  service: Pick<IndexerService, "slicesForVertical">
  adapter: IndexerAdapter
  targets: ReadonlyArray<IndexerReconciliationTarget>
  ownership: IndexerReconciliationOwnership
  /** Preferred scan and delete batch size. Defaults to 250. */
  batchSize?: number
  /**
   * `error` prevents any mutation when maintenance APIs are unavailable.
   * `upsert-only` explicitly permits non-destructive document convergence.
   */
  onMissingAdmin?: "error" | "upsert-only"
}

export interface IndexerReconciliationResult {
  mode: "full" | "upsert-only"
  indexedDocuments: number
  deletedDocuments: number
  droppedSlices: number
}

export class IndexerAdminUnavailableError extends Error {
  constructor() {
    super(
      'Indexer reconciliation requires adapter.admin for stale-document and obsolete-slice cleanup; set onMissingAdmin to "upsert-only" to allow non-destructive reconciliation',
    )
    this.name = "IndexerAdminUnavailableError"
  }
}

/**
 * Converges engine state on a caller-declared expected set without crossing
 * the supplied document and slice ownership boundaries.
 */
export async function reconcileIndexer(
  options: ReconcileIndexerOptions,
): Promise<IndexerReconciliationResult> {
  const batchSize = options.batchSize ?? 250
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("Indexer reconciliation batchSize must be a positive integer")
  }

  const targetsBySlice = validateTargets(options.service, options.targets)
  const admin = options.adapter.admin
  if (!admin && options.onMissingAdmin !== "upsert-only") {
    throw new IndexerAdminUnavailableError()
  }

  let indexedDocuments = 0
  let deletedDocuments = 0

  for (const target of targetsBySlice.values()) {
    const expectedIds = new Set<string>()
    let upsertBatch: IndexerDocument[] = []
    for await (const document of target.loadDocuments()) {
      expectedIds.add(document.id)
      upsertBatch.push(document)
      if (upsertBatch.length < batchSize) continue

      await options.adapter.upsert(target.slice, upsertBatch)
      indexedDocuments += upsertBatch.length
      upsertBatch = []
    }
    if (upsertBatch.length > 0) {
      await options.adapter.upsert(target.slice, upsertBatch)
      indexedDocuments += upsertBatch.length
    }

    if (!admin) continue

    const staleIds: string[] = []
    for await (const document of admin.scan(target.slice, { batchSize })) {
      if (expectedIds.has(document.id)) continue
      if (!options.ownership.ownsDocument(target.slice, document)) continue
      staleIds.push(document.id)
    }

    for (let offset = 0; offset < staleIds.length; offset += batchSize) {
      const deleteBatch = staleIds.slice(offset, offset + batchSize)
      await options.adapter.delete(target.slice, deleteBatch)
      deletedDocuments += deleteBatch.length
    }
  }

  if (!admin) {
    return { mode: "upsert-only", indexedDocuments, deletedDocuments: 0, droppedSlices: 0 }
  }

  let droppedSlices = 0
  for (const slice of await admin.list()) {
    if (isConfiguredSlice(options.service, slice)) continue
    if (!options.ownership.ownsSlice(slice)) continue
    if (await admin.drop(slice)) droppedSlices += 1
  }

  return { mode: "full", indexedDocuments, deletedDocuments, droppedSlices }
}

function validateTargets(
  service: Pick<IndexerService, "slicesForVertical">,
  targets: ReadonlyArray<IndexerReconciliationTarget>,
): Map<string, IndexerReconciliationTarget> {
  const targetsBySlice = new Map<string, IndexerReconciliationTarget>()

  for (const target of targets) {
    const key = sliceKey(target.slice)
    if (targetsBySlice.has(key)) {
      throw new Error(`Indexer reconciliation received duplicate target slice ${key}`)
    }

    if (!isConfiguredSlice(service, target.slice)) {
      throw new Error(`Indexer reconciliation target is not configured in IndexerService: ${key}`)
    }
    targetsBySlice.set(key, target)
  }

  return targetsBySlice
}

function isConfiguredSlice(
  service: Pick<IndexerService, "slicesForVertical">,
  candidate: IndexerSlice,
): boolean {
  const key = sliceKey(candidate)
  return service
    .slicesForVertical(candidate.vertical)
    .some((configured) => sliceKey(configured) === key)
}

function sliceKey(slice: IndexerSlice): string {
  return JSON.stringify([
    slice.vertical,
    slice.locale,
    slice.audience,
    slice.market,
    slice.channel ?? null,
  ])
}
