/**
 * Runtime constants and contracts that workflow hosts may import without
 * loading the promotions module, routes, schemas, or workflow declarations.
 */

/**
 * Service-container key the operator starter registers a concrete
 * implementation against.
 */
export const BULK_REINDEX_SERVICE_KEY = "promotions:bulk-reindex-products" as const

/**
 * Contract the operator starter implements for the bulk-reindex workflow.
 */
export interface BulkReindexProductsService {
  listAllProductIds(): Promise<string[]>
  reindexProduct(productId: string): Promise<void>
}
