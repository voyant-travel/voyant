/**
 * IndexerService — higher-level wrapper around an `IndexerAdapter` that
 * handles the cross-slice orchestration verticals actually need:
 *
 *   - Targeted reindex of one entity across all configured slices.
 *   - Targeted reindex narrowed to a single `(locale, audience, market)`
 *     when an editorial overlay change has narrow scope.
 *   - Deletion across all slices for the same entity.
 *   - `ensureCollections` at deployment startup.
 *   - Search delegation to the underlying adapter.
 *
 * Templates configure the service with their actual slice set (which
 * `(locale, audience, market)` combinations the deployment serves) and the
 * IndexerAdapter implementation (Typesense by default).
 *
 * See `docs/architecture/catalog-architecture.md` §5.4 for the design.
 */

import type {
  IndexerAdapter,
  IndexerDocument,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import type { FieldPolicy, FieldPolicyRegistry } from "../contract.js"

/**
 * Options for constructing an IndexerService.
 */
export interface IndexerServiceOptions {
  /** The underlying IndexerAdapter implementation. */
  adapter: IndexerAdapter
  /**
   * The `(vertical, locale, audience, market)` slices this deployment
   * materializes. Default deployments have ~2 slices per vertical per
   * locale; scale-stage deployments have more.
   */
  slices: IndexerSlice[]
  /**
   * Per-vertical field-policy registries, keyed by `entity_module`.
   * `ensureCollections` and document-emission paths consult the relevant
   * registry to know what to index and how.
   */
  registries: ReadonlyMap<string, FieldPolicyRegistry>
}

/**
 * Builder function the service calls per slice when reindexing — produces
 * the `IndexerDocument` for a particular entity in a particular slice.
 *
 * Verticals supply this via their `DocumentEmitter` (see
 * `../indexer/contract.ts`); the service is engine-agnostic.
 */
export type DocumentBuilder = (
  entityId: string,
  slice: IndexerSlice,
) => Promise<IndexerDocument | null>

/**
 * The IndexerService surface.
 */
export interface IndexerService {
  /**
   * Ensure every configured slice has its engine-side schema set up.
   * Called at deployment startup or after a field-policy registry change.
   */
  ensureCollections(): Promise<void>

  /**
   * Reindex one entity across **all** slices configured for its vertical.
   * Used when a source projection update affects all variant combinations
   * (e.g. a managed-class field changes).
   */
  reindexEntity(entityModule: string, entityId: string, builder: DocumentBuilder): Promise<void>

  /**
   * Reindex one entity for **one specific slice only**. Used when an
   * editorial overlay change has narrow scope (one locale × audience ×
   * market) and rebuilding all slices would be wasteful.
   */
  reindexEntityForSlice(
    slice: IndexerSlice,
    entityId: string,
    builder: DocumentBuilder,
  ): Promise<void>

  /**
   * Delete one entity from every slice configured for its vertical. Used by
   * the source-disconnect cleanup pipeline (§5.10.3) and for hard entity
   * deletions.
   */
  deleteEntity(entityModule: string, entityId: string): Promise<void>

  /**
   * Search delegation — pass-through to the underlying adapter.
   */
  search(slice: IndexerSlice, request: SearchRequest): Promise<SearchResults>

  /**
   * Returns the slices configured for a given vertical. Useful for callers
   * orchestrating bulk operations themselves.
   */
  slicesForVertical(entityModule: string): IndexerSlice[]
}

/**
 * Create the service from its options. Pure construction — no IO until
 * methods are called.
 */
export function createIndexerService(options: IndexerServiceOptions): IndexerService {
  const { adapter, slices, registries } = options

  const slicesForVertical = (entityModule: string): IndexerSlice[] =>
    slices.filter((slice) => slice.vertical === entityModule)

  const requireRegistry = (entityModule: string): FieldPolicyRegistry => {
    const registry = registries.get(entityModule)
    if (!registry) {
      throw new Error(
        `IndexerService: no field-policy registry registered for vertical "${entityModule}"`,
      )
    }
    return registry
  }

  return {
    async ensureCollections() {
      for (const slice of slices) {
        const registry = requireRegistry(slice.vertical)
        await adapter.ensureCollection(slice, registry)
      }
    },

    async reindexEntity(entityModule, entityId, builder) {
      const verticalSlices = slicesForVertical(entityModule)
      for (const slice of verticalSlices) {
        const document = await builder(entityId, slice)
        if (!document) {
          await adapter.delete(slice, [entityId])
          continue
        }
        await adapter.upsert(slice, [document])
      }
    },

    async reindexEntityForSlice(slice, entityId, builder) {
      const document = await builder(entityId, slice)
      if (!document) {
        await adapter.delete(slice, [entityId])
        return
      }
      await adapter.upsert(slice, [document])
    },

    async deleteEntity(entityModule, entityId) {
      const verticalSlices = slicesForVertical(entityModule)
      for (const slice of verticalSlices) {
        await adapter.delete(slice, [entityId])
      }
    },

    async search(slice, request) {
      return adapter.search(slice, request)
    },

    slicesForVertical,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an `IndexerDocument` from a field-keyed projection, filtered by:
 *   - Visibility — for storefront slices (`customer` / `partner` / `supplier`),
 *     only fields whose policy `visibility[]` includes the slice audience.
 *     For admin slices (the `staff-admin` sentinel), all fields visible to
 *     any audience are included so the admin search document carries the
 *     cross-audience denormalized text described in architecture §5.4.4.
 *   - Queryability — `blob-only` fields are skipped (stored on the entity row
 *     but not indexed). `indexed-column` and `first-class-table` fields land
 *     in the document.
 *
 * Field paths ending in `[]` (lists) are renamed to drop the suffix so the
 * indexer schema field names match (`gallery[]` → `gallery`).
 *
 * Pure logic — no IO. Sync emitters use this directly; async builders wrap
 * it with row-fetching.
 *
 * Used by every vertical's `DocumentEmitter` implementation.
 */
export function buildIndexerDocument(
  registry: FieldPolicyRegistry,
  projection: ReadonlyMap<string, unknown>,
  slice: IndexerSlice,
  entityId: string,
): IndexerDocument {
  const fields: Record<string, unknown> = {}
  for (const [path, value] of projection) {
    let policy = registry.resolve(path)
    let policyPath = path
    if (!policy && Array.isArray(value)) {
      const listPath = `${path}[]`
      policy = registry.resolve(listPath)
      policyPath = listPath
    }
    if (!policy) continue
    if (!shouldIndexInDocument(policy, slice.audience)) continue
    const fieldName = policyPath.endsWith("[]") ? policyPath.slice(0, -2) : policyPath
    fields[fieldName] = value
  }
  return { id: entityId, fields }
}

function shouldIndexInDocument(policy: FieldPolicy, audience: IndexerSlice["audience"]): boolean {
  // Skip blob-only fields — they're stored on the entity row, not indexed.
  if (policy.query === "blob-only") return false

  // Admin slices carry cross-audience text (§5.4.4) — include any field
  // visible to any audience. The admin search document is queryable only
  // by staff actors so cross-audience denormalization is safe here.
  if (audience === "staff-admin") {
    return policy.visibility.length > 0
  }

  // Storefront slices: only fields visible to that specific audience.
  return policy.visibility.includes(audience as never)
}
