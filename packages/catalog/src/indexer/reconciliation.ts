import { createReadStream } from "node:fs"
import { access, appendFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import type {
  IndexerDocument,
  IndexerSlice,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import type { IndexerExclusiveWriteLease, IndexerService } from "../services/indexer-service.js"

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

/** Bounded state for one target slice during one reconciliation attempt. */
export interface IndexerReconciliationState {
  addExpectedId(id: string): Promise<void>
  hasExpectedId(id: string): Promise<boolean>
  addStaleId(id: string): Promise<void>
  staleIdBatches(batchSize: number): AsyncIterable<string[]>
  /** Release all state for this attempt. Must be idempotent. */
  dispose(): Promise<void>
}

/** Creates isolated, disposable state for each reconciled slice. */
export interface IndexerReconciliationStateStore {
  create(slice: IndexerSlice): Promise<IndexerReconciliationState>
}

export interface FileIndexerReconciliationStateStoreOptions {
  /** Parent directory for temporary state. Defaults to the operating-system temp directory. */
  directory?: string
  /** Number of expected-id hash buckets. Defaults to 256. */
  expectedIdBuckets?: number
}

/**
 * Create the default Node reconciliation state store. Expected IDs are hash
 * bucketed on disk for bounded-memory membership checks; stale IDs are
 * streamed from a spool only after the provider scan has completed.
 */
export function createFileIndexerReconciliationStateStore(
  options: FileIndexerReconciliationStateStoreOptions = {},
): IndexerReconciliationStateStore {
  const directory = options.directory ?? tmpdir()
  const expectedIdBuckets = options.expectedIdBuckets ?? 256
  if (!Number.isSafeInteger(expectedIdBuckets) || expectedIdBuckets < 1) {
    throw new Error("Indexer reconciliation expectedIdBuckets must be a positive integer")
  }

  return {
    async create() {
      await mkdir(directory, { recursive: true })
      const root = await mkdtemp(join(directory, "voyant-index-reconciliation-"))
      return new FileIndexerReconciliationState(root, expectedIdBuckets)
    },
  }
}

export interface ReconcileIndexerOptions {
  /** Service supplying the configured slices, adapter, and write coordinator. */
  service: IndexerService
  /** Active exclusive lease issued by `service.withExclusiveWriteLease`. */
  lease: IndexerExclusiveWriteLease
  targets: ReadonlyArray<IndexerReconciliationTarget>
  /** Explicit, owned, no-longer-configured slices that may be dropped. */
  obsoleteSlices?: ReadonlyArray<IndexerSlice>
  ownership: IndexerReconciliationOwnership
  /** Preferred upsert, scan, and delete batch size. Defaults to 250. */
  batchSize?: number
  /** Bounded reconciliation state. Defaults to a temporary filesystem store. */
  stateStore?: IndexerReconciliationStateStore
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
      'Indexer reconciliation requires service.adapter.admin for stale-document and obsolete-slice cleanup; set onMissingAdmin to "upsert-only" to allow non-destructive reconciliation',
    )
    this.name = "IndexerAdminUnavailableError"
  }
}

/**
 * Converges engine state on caller-declared expected and obsolete sets. The
 * operation accepts only a currently active exclusive service lease, keeping
 * live writes outside the scan/delete boundary.
 */
export async function reconcileIndexer(
  options: ReconcileIndexerOptions,
): Promise<IndexerReconciliationResult> {
  return options.lease.run(options.service, () => reconcileWithLease(options))
}

async function reconcileWithLease(
  options: ReconcileIndexerOptions,
): Promise<IndexerReconciliationResult> {
  const batchSize = options.batchSize ?? 250
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("Indexer reconciliation batchSize must be a positive integer")
  }

  const targets = validateTargets(options.service, options.targets)
  const obsoleteSlices = validateObsoleteSlices(
    options.service,
    options.obsoleteSlices ?? [],
    options.ownership,
  )
  const adapter = options.service.adapter
  const admin = adapter.admin
  if (!admin && options.onMissingAdmin !== "upsert-only") {
    throw new IndexerAdminUnavailableError()
  }

  await options.lease.ensureCollections(
    options.service,
    targets.map(({ slice }) => slice),
  )

  const stateStore = options.stateStore ?? createFileIndexerReconciliationStateStore()
  let indexedDocuments = 0
  let deletedDocuments = 0

  for (const target of targets) {
    const state = await stateStore.create(target.slice)
    try {
      let upsertBatch: IndexerDocument[] = []
      for await (const document of target.loadDocuments()) {
        await state.addExpectedId(document.id)
        upsertBatch.push(document)
        if (upsertBatch.length < batchSize) continue

        await adapter.upsert(target.slice, upsertBatch)
        indexedDocuments += upsertBatch.length
        upsertBatch = []
      }
      if (upsertBatch.length > 0) {
        await adapter.upsert(target.slice, upsertBatch)
        indexedDocuments += upsertBatch.length
      }

      if (!admin) continue

      for await (const document of admin.scan(target.slice, { batchSize })) {
        if (await state.hasExpectedId(document.id)) continue
        if (!options.ownership.ownsDocument(target.slice, document)) continue
        await state.addStaleId(document.id)
      }

      for await (const deleteBatch of state.staleIdBatches(batchSize)) {
        await adapter.delete(target.slice, deleteBatch)
        deletedDocuments += deleteBatch.length
      }
    } finally {
      await state.dispose()
    }
  }

  if (!admin) {
    return { mode: "upsert-only", indexedDocuments, deletedDocuments: 0, droppedSlices: 0 }
  }

  let droppedSlices = 0
  for (const slice of obsoleteSlices) {
    if (await admin.drop(slice)) droppedSlices += 1
  }

  return { mode: "full", indexedDocuments, deletedDocuments, droppedSlices }
}

function validateTargets(
  service: IndexerService,
  targets: ReadonlyArray<IndexerReconciliationTarget>,
): IndexerReconciliationTarget[] {
  const seen = new Set<string>()

  for (const target of targets) {
    const key = sliceKey(target.slice)
    if (seen.has(key)) {
      throw new Error(`Indexer reconciliation received duplicate target slice ${key}`)
    }
    if (!isConfiguredSlice(service, target.slice)) {
      throw new Error(`Indexer reconciliation target is not configured in IndexerService: ${key}`)
    }
    seen.add(key)
  }

  return [...targets]
}

function validateObsoleteSlices(
  service: IndexerService,
  candidates: ReadonlyArray<IndexerSlice>,
  ownership: IndexerReconciliationOwnership,
): IndexerSlice[] {
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const key = sliceKey(candidate)
    if (seen.has(key)) {
      throw new Error(`Indexer reconciliation received duplicate obsolete slice ${key}`)
    }
    if (isConfiguredSlice(service, candidate)) {
      throw new Error(`Indexer reconciliation cannot drop configured slice ${key}`)
    }
    if (!ownership.ownsSlice(candidate)) {
      throw new Error(`Indexer reconciliation does not own obsolete slice ${key}`)
    }
    seen.add(key)
  }

  return [...candidates]
}

function isConfiguredSlice(service: IndexerService, candidate: IndexerSlice): boolean {
  const key = sliceKey(candidate)
  return service
    .slicesForVertical(candidate.vertical)
    .some((configured) => sliceKey(configured) === key)
}

class FileIndexerReconciliationState implements IndexerReconciliationState {
  private disposed = false

  constructor(
    private readonly root: string,
    private readonly expectedIdBuckets: number,
  ) {}

  async addExpectedId(id: string): Promise<void> {
    this.requireActive()
    await appendFile(this.expectedPath(id), encodeId(id), "utf8")
  }

  async hasExpectedId(id: string): Promise<boolean> {
    this.requireActive()
    for await (const expectedId of readIds(this.expectedPath(id))) {
      if (expectedId === id) return true
    }
    return false
  }

  async addStaleId(id: string): Promise<void> {
    this.requireActive()
    await appendFile(this.stalePath(), encodeId(id), "utf8")
  }

  async *staleIdBatches(batchSize: number): AsyncIterable<string[]> {
    this.requireActive()
    let batch: string[] = []
    for await (const id of readIds(this.stalePath())) {
      batch.push(id)
      if (batch.length < batchSize) continue
      yield batch
      batch = []
    }
    if (batch.length > 0) yield batch
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await rm(this.root, { recursive: true, force: true })
  }

  private expectedPath(id: string): string {
    return join(this.root, `expected-${hashId(id) % this.expectedIdBuckets}.jsonl`)
  }

  private stalePath(): string {
    return join(this.root, "stale.jsonl")
  }

  private requireActive() {
    if (this.disposed) throw new Error("Indexer reconciliation state has been disposed")
  }
}

async function* readIds(path: string): AsyncIterable<string> {
  try {
    await access(path)
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return
    throw error
  }

  const lines = createInterface({
    input: createReadStream(path),
    crlfDelay: Number.POSITIVE_INFINITY,
  })
  try {
    for await (const line of lines) {
      if (line.length > 0) yield JSON.parse(line) as string
    }
  } finally {
    lines.close()
  }
}

function encodeId(id: string): string {
  return `${JSON.stringify(id)}\n`
}

function hashId(id: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
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
