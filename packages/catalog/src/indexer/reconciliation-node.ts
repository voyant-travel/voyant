/// <reference types="node" />

import { createReadStream } from "node:fs"
import { access, appendFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import type {
  IndexerAdapter,
  IndexerDocument,
  IndexerSlice,
} from "@voyant-travel/catalog-contracts/indexer/contract"

export interface IndexerReconciliationTarget {
  /** A configured slice whose complete expected document set is supplied. */
  slice: IndexerSlice
  /**
   * Creates a fresh document stream for every reconciliation attempt. Batches
   * are applied sequentially; repeated IDs within a batch collapse to its last
   * occurrence, and later batches replace earlier ones. Retrying converges.
   */
  loadDocuments(): AsyncIterable<IndexerDocument> | Iterable<IndexerDocument>
}

export interface IndexerReconciliationOwnership {
  /** Whether this reconciliation owns the entire lifecycle of a slice. */
  ownsSlice(slice: IndexerSlice): boolean
  /** Whether an indexed document may be deleted when it is not expected. */
  ownsDocument(slice: IndexerSlice, document: IndexerDocument): boolean
}

/** Adapter and configuration exposed only while the caller's lock is held. */
export interface IndexerReconciliationExclusiveContext {
  readonly adapter: IndexerAdapter
  readonly configuredSlices: readonly IndexerSlice[]
  ensureCollections(slices: readonly IndexerSlice[]): Promise<void>
}

/**
 * Deployment-owned reconciliation authority. `runExclusive` must acquire a
 * long-lived backend or distributed write lock shared by every index mutation
 * path in every process before exposing the callback context. A process-local
 * mutex or an authority created per IndexerService is insufficient. This
 * package intentionally provides no default implementation or generic
 * conformance assertion: deployments must verify exclusion with a
 * process-separated, backend-specific integration test.
 */
export interface IndexerReconciliationAuthority {
  runExclusive<T>(
    operation: (context: IndexerReconciliationExclusiveContext) => Promise<T>,
  ): Promise<T>
}

/** Partitioned state for one target slice during one reconciliation attempt. */
export interface IndexerReconciliationState {
  writeExpectedIds(ids: readonly string[]): Promise<void>
  writeCandidateIds(ids: readonly string[]): Promise<void>
  /** Prevent further writes before stale bucket reads begin. */
  seal(): Promise<void>
  staleIdBatches(batchSize: number): AsyncIterable<string[]>
  /** Release all state for this attempt. Must be idempotent and retryable. */
  dispose(): Promise<void>
}

/** Creates isolated, disposable state for each reconciled slice. */
export interface IndexerReconciliationStateStore {
  create(slice: IndexerSlice): Promise<IndexerReconciliationState>
}

export interface FileIndexerReconciliationStateStoreOptions {
  /** Parent directory for temporary state. Defaults to the operating-system temp directory. */
  directory?: string
  /** Number of expected/candidate hash buckets. Defaults to 256; maximum 4096. */
  buckets?: number
}

const MAX_RECONCILIATION_BUCKETS = 4_096

/**
 * Create the default Node reconciliation state store. IDs are grouped into
 * append-and-close writes, then partitions are processed one bucket at a time
 * after the provider scan closes. Memory is partition-bounded rather than
 * globally bounded: one heavily skewed bucket can grow with the corpus.
 */
export function createFileIndexerReconciliationStateStore(
  options: FileIndexerReconciliationStateStoreOptions = {},
): IndexerReconciliationStateStore {
  const directory = options.directory ?? tmpdir()
  const buckets = options.buckets ?? 256
  if (!Number.isSafeInteger(buckets) || buckets < 1 || buckets > MAX_RECONCILIATION_BUCKETS) {
    throw new Error(
      `Indexer reconciliation buckets must be an integer between 1 and ${MAX_RECONCILIATION_BUCKETS}`,
    )
  }

  return {
    async create() {
      await mkdir(directory, { recursive: true })
      const root = await mkdtemp(join(directory, "voyant-index-reconciliation-"))
      return new FileIndexerReconciliationState(root, buckets)
    },
  }
}

export interface ReconcileIndexerOptions {
  /**
   * Required deployment authority for adapter/config access and a distributed
   * exclusive write boundary. The package does not provide an in-process default.
   */
  authority: IndexerReconciliationAuthority
  targets: ReadonlyArray<IndexerReconciliationTarget>
  /** Explicit, owned, no-longer-configured slices that may be dropped. */
  obsoleteSlices?: ReadonlyArray<IndexerSlice>
  ownership: IndexerReconciliationOwnership
  /** Preferred upsert, scan, spool, and delete batch size. Defaults to 250. */
  batchSize?: number
  /** Partitioned reconciliation state. Defaults to a temporary filesystem store. */
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
      'Indexer reconciliation requires authority context adapter.admin for stale-document and obsolete-slice cleanup; set onMissingAdmin to "upsert-only" to allow non-destructive reconciliation',
    )
    this.name = "IndexerAdminUnavailableError"
  }
}

/**
 * Converges engine state within the caller's deployment-wide exclusive write
 * boundary. Obsolete slices are considered only when explicitly supplied.
 */
export async function reconcileIndexer(
  options: ReconcileIndexerOptions,
): Promise<IndexerReconciliationResult> {
  return options.authority.runExclusive((context) => reconcileExclusive(options, context))
}

async function reconcileExclusive(
  options: ReconcileIndexerOptions,
  context: IndexerReconciliationExclusiveContext,
): Promise<IndexerReconciliationResult> {
  const batchSize = options.batchSize ?? 250
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("Indexer reconciliation batchSize must be a positive integer")
  }

  const targets = validateTargets(context.configuredSlices, options.targets)
  const obsoleteSlices = validateObsoleteSlices(
    context.configuredSlices,
    options.obsoleteSlices ?? [],
    options.ownership,
  )
  const { adapter } = context
  const admin = adapter.admin
  if (!admin && options.onMissingAdmin !== "upsert-only") {
    throw new IndexerAdminUnavailableError()
  }

  await context.ensureCollections(targets.map(({ slice }) => slice))

  const stateStore = options.stateStore ?? createFileIndexerReconciliationStateStore()
  let indexedDocuments = 0
  let deletedDocuments = 0

  for (const target of targets) {
    const state = await stateStore.create(target.slice)
    let operationFailed = false
    let operationError: unknown
    try {
      let upsertBatch: IndexerDocument[] = []
      for await (const document of target.loadDocuments()) {
        upsertBatch.push(document)
        if (upsertBatch.length < batchSize) continue

        const documents = lastDocumentById(upsertBatch)
        await state.writeExpectedIds(documents.map(({ id }) => id))
        await adapter.upsert(target.slice, documents)
        indexedDocuments += documents.length
        upsertBatch = []
      }
      if (upsertBatch.length > 0) {
        const documents = lastDocumentById(upsertBatch)
        await state.writeExpectedIds(documents.map(({ id }) => id))
        await adapter.upsert(target.slice, documents)
        indexedDocuments += documents.length
      }

      if (!admin) {
        await state.seal()
      } else {
        let candidateBatch: string[] = []
        for await (const document of admin.scan(target.slice, { batchSize })) {
          if (!options.ownership.ownsDocument(target.slice, document)) continue
          candidateBatch.push(document.id)
          if (candidateBatch.length < batchSize) continue
          await state.writeCandidateIds(candidateBatch)
          candidateBatch = []
        }
        if (candidateBatch.length > 0) await state.writeCandidateIds(candidateBatch)

        await state.seal()
        for await (const deleteBatch of state.staleIdBatches(batchSize)) {
          await adapter.delete(target.slice, deleteBatch)
          deletedDocuments += deleteBatch.length
        }
      }
    } catch (error) {
      operationFailed = true
      operationError = error
    }

    let cleanupFailed = false
    let cleanupError: unknown
    try {
      await disposeReconciliationState(state)
    } catch (error) {
      cleanupFailed = true
      cleanupError = error
    }

    if (operationFailed && cleanupFailed) {
      throw new AggregateError(
        [operationError, cleanupError],
        "Indexer reconciliation operation and state cleanup both failed",
      )
    }
    if (operationFailed) throw operationError
    if (cleanupFailed) throw cleanupError
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
  configuredSlices: readonly IndexerSlice[],
  targets: ReadonlyArray<IndexerReconciliationTarget>,
): IndexerReconciliationTarget[] {
  const configured = configuredSliceKeys(configuredSlices)
  const seen = new Set<string>()

  for (const target of targets) {
    const key = canonicalSliceKey(target.slice)
    if (seen.has(key)) {
      throw new Error(`Indexer reconciliation received duplicate target slice ${key}`)
    }
    if (!configured.has(key)) {
      throw new Error(`Indexer reconciliation target is not configured: ${key}`)
    }
    seen.add(key)
  }

  return [...targets]
}

function validateObsoleteSlices(
  configuredSlices: readonly IndexerSlice[],
  candidates: ReadonlyArray<IndexerSlice>,
  ownership: IndexerReconciliationOwnership,
): IndexerSlice[] {
  const configured = configuredSliceKeys(configuredSlices)
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const key = canonicalSliceKey(candidate)
    if (seen.has(key)) {
      throw new Error(`Indexer reconciliation received duplicate obsolete slice ${key}`)
    }
    if (configured.has(key)) {
      throw new Error(`Indexer reconciliation cannot drop configured slice ${key}`)
    }
    if (!ownership.ownsSlice(candidate)) {
      throw new Error(`Indexer reconciliation does not own obsolete slice ${key}`)
    }
    seen.add(key)
  }

  return [...candidates]
}

type SpoolKind = "expected" | "candidate"

class FileIndexerReconciliationState implements IndexerReconciliationState {
  private readonly populatedBuckets: Record<SpoolKind, Set<number>> = {
    expected: new Set(),
    candidate: new Set(),
  }
  private sealed = false
  private disposed = false

  constructor(
    private readonly root: string,
    private readonly buckets: number,
  ) {}

  writeExpectedIds(ids: readonly string[]): Promise<void> {
    return this.writeIds("expected", ids)
  }

  writeCandidateIds(ids: readonly string[]): Promise<void> {
    return this.writeIds("candidate", ids)
  }

  async seal(): Promise<void> {
    this.requireActive()
    if (this.sealed) return
    this.sealed = true
  }

  async *staleIdBatches(batchSize: number): AsyncIterable<string[]> {
    this.requireSealed()
    let batch: string[] = []

    const populatedBuckets = new Set([
      ...this.populatedBuckets.expected,
      ...this.populatedBuckets.candidate,
    ])
    for (const bucket of [...populatedBuckets].sort((left, right) => left - right)) {
      const expected = new Set<string>()
      for await (const id of readIds(this.bucketPath("expected", bucket))) expected.add(id)
      const candidates = new Set<string>()

      for await (const id of readIds(this.bucketPath("candidate", bucket))) {
        if (candidates.has(id)) continue
        candidates.add(id)
        if (expected.has(id)) continue
        batch.push(id)
        if (batch.length < batchSize) continue
        yield batch
        batch = []
      }
    }

    if (batch.length > 0) yield batch
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    await rm(this.root, { recursive: true, force: true })
    this.disposed = true
  }

  private async writeIds(kind: SpoolKind, ids: readonly string[]): Promise<void> {
    this.requireWritable()
    const idsByBucket = new Map<number, string[]>()
    for (const id of ids) {
      const bucket = hashId(id) % this.buckets
      const bucketIds = idsByBucket.get(bucket) ?? []
      bucketIds.push(id)
      idsByBucket.set(bucket, bucketIds)
    }

    for (const [bucket, bucketIds] of idsByBucket) {
      await appendFile(this.bucketPath(kind, bucket), bucketIds.map(encodeId).join(""), "utf8")
      this.populatedBuckets[kind].add(bucket)
    }
  }

  private bucketPath(kind: SpoolKind, bucket: number): string {
    return join(this.root, `${kind}-${bucket}.jsonl`)
  }

  private requireWritable() {
    this.requireActive()
    if (this.sealed) throw new Error("Indexer reconciliation state has been sealed")
  }

  private requireSealed() {
    this.requireActive()
    if (!this.sealed) throw new Error("Indexer reconciliation state must be sealed before reading")
  }

  private requireActive() {
    if (this.disposed) throw new Error("Indexer reconciliation state has been disposed")
  }
}

function lastDocumentById(documents: readonly IndexerDocument[]): IndexerDocument[] {
  return [...new Map(documents.map((document) => [document.id, document])).values()]
}

async function disposeReconciliationState(state: IndexerReconciliationState): Promise<void> {
  try {
    await state.dispose()
  } catch (firstError) {
    try {
      await state.dispose()
    } catch (secondError) {
      throw new AggregateError(
        [firstError, secondError],
        "Indexer reconciliation state cleanup failed after retry",
      )
    }
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

function configuredSliceKeys(slices: readonly IndexerSlice[]): Set<string> {
  const configured = new Set<string>()
  for (const slice of slices) {
    const key = canonicalSliceKey(slice)
    if (configured.has(key)) {
      throw new Error(`Indexer reconciliation has duplicate configured slice identity ${key}`)
    }
    configured.add(key)
  }
  return configured
}

function canonicalSliceKey(slice: IndexerSlice): string {
  for (const [component, value] of [
    ["vertical", slice.vertical],
    ["locale", slice.locale],
    ["audience", slice.audience],
    ["market", slice.market],
  ] as const) {
    if (value.trim().length === 0) {
      throw new Error(`Indexer reconciliation slice ${component} must not be empty`)
    }
  }
  if (slice.channel !== undefined && slice.channel !== "" && slice.channel.trim().length === 0) {
    throw new Error("Indexer reconciliation slice channel must be omitted or non-blank")
  }

  return JSON.stringify([
    slice.vertical,
    slice.locale,
    slice.audience,
    slice.market,
    slice.channel || null,
  ])
}
