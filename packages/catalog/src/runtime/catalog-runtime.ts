/**
 * Shared catalog-plane runtime helpers.
 *
 * Centralizes the env-driven construction of the Typesense indexer + the
 * default slice set so both the per-request MCP route handler and the
 * background catalog-bridge subscribers stay aligned.
 */

import {
  createFieldPolicyRegistry,
  type FieldPolicyRegistry,
} from "@voyant-travel/catalog/contract"
import type { EmbeddingProvider } from "@voyant-travel/catalog/embeddings/contract"
import type { IndexerAdapter, IndexerSlice } from "@voyant-travel/catalog/indexer/contract"
import {
  buildCatalogEmbeddingProvider,
  buildCatalogSlices,
  buildCatalogTypesenseIndexer,
  DEFAULT_CATALOG_SLICES,
  DEFAULT_CATALOG_VERTICALS,
  withCatalogEmbedding,
} from "@voyant-travel/catalog/runtime-support"
import type { DocumentBuilder } from "@voyant-travel/catalog/services/indexer"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import { isOwnedProductStorefrontListable } from "./catalog-listability.js"
import { catalogRuntimeExtensions } from "./host.js"

export const CATALOG_VERTICALS = DEFAULT_CATALOG_VERTICALS

/**
 * The slice set the operator starter indexes by default — staff (admin
 * search) + customer (storefront browse) on en-GB and the `default` market.
 * Kept in one place so the bulk-reindex CLI, the live-reindex bridge, and
 * the MCP routes never drift on which collections exist.
 */
export const DEFAULT_SLICES = DEFAULT_CATALOG_SLICES

export async function loadCatalogSlices(db: AnyDrizzleDb): Promise<IndexerSlice[]> {
  const { commerce, distribution } = catalogRuntimeExtensions()
  const [{ markets, locales }, channelIds] = await Promise.all([
    commerce.loadSliceInputs(db),
    distribution.loadActiveChannelIds(db),
  ])

  return buildCatalogSlices({
    markets,
    locales,
    channelIds: [...channelIds],
  })
}

export type CatalogRuntimeEnv = {
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
}

export const buildEmbeddingProvider = buildCatalogEmbeddingProvider

export function buildTypesenseIndexer(
  env: CatalogRuntimeEnv,
  embeddings?: EmbeddingProvider,
): IndexerAdapter | undefined {
  return buildCatalogTypesenseIndexer(env, {
    embeddings,
    registries: getFieldPolicyRegistries(),
  })
}

let _registries: Map<string, FieldPolicyRegistry> | undefined
export function getFieldPolicyRegistries(): Map<string, FieldPolicyRegistry> {
  if (!_registries) {
    const { accommodations, charters, cruises, inventory } = catalogRuntimeExtensions()
    _registries = new Map<string, FieldPolicyRegistry>([
      ["products", createFieldPolicyRegistry([...inventory.productFieldPolicy])],
      ["extras", createFieldPolicyRegistry([...inventory.extrasFieldPolicy])],
      ["cruises", cruises.createRegistry(cruises.fieldPolicy)],
      ["charters", createFieldPolicyRegistry([...charters.fieldPolicy])],
      ["accommodations", createFieldPolicyRegistry([...accommodations.fieldPolicy])],
    ])
  }
  return _registries
}

export function createProductsDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string },
): DocumentBuilder {
  const { commerce, distribution, inventory, operations } = catalogRuntimeExtensions()
  const registry = getFieldPolicyRegistries().get("products")
  return inventory.createDocumentBuilder({
    db,
    sellerOperatorId: context.sellerOperatorId,
    registry,
    extensions: [
      inventory.createStorefrontCardProjectionExtension(),
      inventory.createDestinationsProjectionExtension(),
      inventory.createTaxonomyProjectionExtension(),
      operations.createDeparturesProjectionExtension(),
      commerce.createPricingProjectionExtension(),
      commerce.createPromotionsProjectionExtension(),
    ],
    isPublicAudienceListable: ({ db, product, slice }) =>
      isOwnedProductStorefrontListable({
        audience: slice.audience,
        channel: slice.channel,
        hasActiveChannelMapping: () =>
          distribution.hasActiveSalesChannelMapping(db, product.id, slice.channel),
      }),
  })
}

export function createCruisesDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string },
): DocumentBuilder {
  const { cruises } = catalogRuntimeExtensions()
  const registry = getFieldPolicyRegistries().get("cruises")
  return cruises.createDocumentBuilder({
    db,
    sellerOperatorId: context.sellerOperatorId,
    registry,
    extensions: [cruises.createCabinFacetProjectionExtension()],
  })
}

export function withEmbedding(
  inner: DocumentBuilder,
  embeddings: EmbeddingProvider | undefined,
): DocumentBuilder {
  return withCatalogEmbedding(inner, embeddings)
}
