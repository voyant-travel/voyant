/**
 * Shared catalog-plane runtime helpers.
 *
 * Centralizes the env-driven construction of the Typesense indexer + the
 * default slice set so both the per-request MCP route handler and the
 * background catalog-bridge subscribers stay aligned.
 */

import { accommodationCatalogPolicy } from "@voyant-travel/accommodations/catalog-policy"
import { charterCatalogPolicy } from "@voyant-travel/charters/catalog-policy"
import {
  createProductPricingProjectionExtension,
  createProductPromotionsProjectionExtension,
  loadProductPriceFrom,
  marketLocales,
  markets,
} from "@voyant-travel/commerce"
import { cruiseCabinFacetsCatalogPolicy } from "@voyant-travel/cruises/catalog-policy-cabins"
import {
  createCruiseDocumentBuilder,
  createCruisesRegistry,
} from "@voyant-travel/cruises/service-catalog-plane"
import { createCruiseCabinFacetProjectionExtension } from "@voyant-travel/cruises/service-catalog-plane-cabins"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { channels } from "@voyant-travel/distribution"
import { productCatalogPolicy } from "@voyant-travel/inventory/catalog-policy"
import { productDeparturesCatalogPolicy } from "@voyant-travel/inventory/catalog-policy-departures"
import { productDestinationsCatalogPolicy } from "@voyant-travel/inventory/catalog-policy-destinations"
import { productPricingCatalogPolicy } from "@voyant-travel/inventory/catalog-policy-pricing"
import { productPromotionsCatalogPolicy } from "@voyant-travel/inventory/catalog-policy-promotions"
import { productTaxonomyCatalogPolicy } from "@voyant-travel/inventory/catalog-policy-taxonomy"
import { extrasCatalogPolicy } from "@voyant-travel/inventory/extras"
import {
  createProductDocumentBuilder,
  createProductStorefrontCardProjectionExtension,
} from "@voyant-travel/inventory/service-catalog-plane"
import { createProductDestinationsProjectionExtension } from "@voyant-travel/inventory/service-catalog-plane-destinations"
import { createProductTaxonomyProjectionExtension } from "@voyant-travel/inventory/service-catalog-plane-taxonomy"
import { createProductDeparturesProjectionExtension } from "@voyant-travel/operations"
import { asc, eq } from "drizzle-orm"
import { createFieldPolicyRegistry, type FieldPolicyRegistry } from "../contract.js"
import type { EmbeddingProvider } from "../embeddings/contract.js"
import type { IndexerAdapter, IndexerSlice } from "../indexer/contract.js"
import {
  buildCatalogEmbeddingProvider,
  buildCatalogSlices,
  buildCatalogTypesenseIndexer,
  DEFAULT_CATALOG_SLICES,
  DEFAULT_CATALOG_VERTICALS,
  withCatalogEmbedding,
} from "../operator-runtime.js"
import type { DocumentBuilder } from "../services/indexer-service.js"

import {
  hasActiveSalesChannelMapping,
  isOwnedProductStorefrontListable,
} from "./catalog-listability.js"

export const CATALOG_VERTICALS = DEFAULT_CATALOG_VERTICALS

/**
 * The slice set the operator starter indexes by default — staff (admin
 * search) + customer (storefront browse) on en-GB and the `default` market.
 * Kept in one place so the bulk-reindex CLI, the live-reindex bridge, and
 * the MCP routes never drift on which collections exist.
 */
export const DEFAULT_SLICES = DEFAULT_CATALOG_SLICES

export async function loadCatalogSlices(db: AnyDrizzleDb): Promise<IndexerSlice[]> {
  const [marketRows, localeRows] = await Promise.all([
    db
      .select({
        id: markets.id,
        defaultLanguageTag: markets.defaultLanguageTag,
      })
      .from(markets)
      .where(eq(markets.status, "active"))
      .orderBy(asc(markets.code)),
    db
      .select({
        marketId: marketLocales.marketId,
        languageTag: marketLocales.languageTag,
      })
      .from(marketLocales)
      .where(eq(marketLocales.active, true))
      .orderBy(asc(marketLocales.sortOrder), asc(marketLocales.languageTag)),
  ])
  const channelRows = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.status, "active"))
    .orderBy(asc(channels.createdAt))

  return buildCatalogSlices({
    markets: marketRows,
    locales: localeRows,
    channelIds: channelRows.map((channel) => channel.id),
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
    _registries = new Map<string, FieldPolicyRegistry>([
      [
        "products",
        createFieldPolicyRegistry([
          ...productCatalogPolicy,
          ...productDestinationsCatalogPolicy,
          ...productTaxonomyCatalogPolicy,
          ...productDeparturesCatalogPolicy,
          ...productPricingCatalogPolicy,
          ...productPromotionsCatalogPolicy,
        ]),
      ],
      ["extras", createFieldPolicyRegistry(extrasCatalogPolicy)],
      ["cruises", createCruisesRegistry(cruiseCabinFacetsCatalogPolicy)],
      ["charters", createFieldPolicyRegistry(charterCatalogPolicy)],
      ["accommodations", createFieldPolicyRegistry(accommodationCatalogPolicy)],
    ])
  }
  return _registries
}

export function createProductsDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string },
): DocumentBuilder {
  const registry = getFieldPolicyRegistries().get("products")
  return createProductDocumentBuilder(db, {
    sellerOperatorId: context.sellerOperatorId,
    registry,
    extensions: [
      createProductStorefrontCardProjectionExtension(),
      createProductDestinationsProjectionExtension(),
      createProductTaxonomyProjectionExtension(),
      createProductDeparturesProjectionExtension(),
      createProductPricingProjectionExtension(),
      createProductPromotionsProjectionExtension({ loadOriginalPrice: loadProductPriceFrom }),
    ],
    isPublicAudienceListable: ({ db, product, slice }) =>
      isOwnedProductStorefrontListable({
        audience: slice.audience,
        channel: slice.channel,
        hasActiveChannelMapping: () => hasActiveSalesChannelMapping(db, product.id, slice.channel),
      }),
  })
}

export function createCruisesDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string },
): DocumentBuilder {
  const registry = getFieldPolicyRegistries().get("cruises")
  return createCruiseDocumentBuilder(db, {
    sellerOperatorId: context.sellerOperatorId,
    registry,
    extensions: [createCruiseCabinFacetProjectionExtension()],
  })
}

export function withEmbedding(
  inner: DocumentBuilder,
  embeddings: EmbeddingProvider | undefined,
): DocumentBuilder {
  return withCatalogEmbedding(inner, embeddings)
}
