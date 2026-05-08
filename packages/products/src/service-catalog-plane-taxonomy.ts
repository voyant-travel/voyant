/**
 * Projection extension that joins product → categories (with ancestor walk)
 * and product → tags, contributing taxonomy fields onto the product search
 * document.
 *
 * Wire via `createProductDocumentBuilder({ extensions: [taxonomyExtension] })`.
 * Requires the registry to include `productTaxonomyCatalogPolicy` —
 * otherwise the contributed fields are silently dropped by the indexer's
 * field-policy filter.
 *
 * Hierarchy denormalization: Typesense can't recurse, so a product linked
 * to "Hiking" (parent: "Adventure") needs both labels in `categories[]` for
 * the "Adventure" filter to match. The projection walks the parent chain
 * iteratively, filtering inactive ancestors (so an operator-paused parent
 * stops surfacing its still-active children under the parent filter).
 *
 * Today's schema has no translation tables for categories/tags (single
 * `name` columns). The same name lands on every locale slice. Locale support
 * is a follow-up that needs a schema migration with backfill.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq, inArray } from "drizzle-orm"

import {
  productCategories,
  productCategoryProducts,
  productTagProducts,
  productTags,
} from "./schema-taxonomy.js"
import type { ProductProjectionExtension } from "./service-catalog-plane.js"

interface CategoryRow {
  id: string
  parentId: string | null
  name: string
  slug: string
  active: boolean
}

interface DirectCategoryLink {
  categoryId: string
  sortOrder: number
}

/**
 * Resolve linked category ids for a product, ordered by the operator-set
 * `sortOrder` on `product_category_products` (lowest first). Direct links
 * only — ancestors are walked separately.
 */
async function fetchDirectCategoryLinks(
  db: AnyDrizzleDb,
  productId: string,
): Promise<DirectCategoryLink[]> {
  return db
    .select({
      categoryId: productCategoryProducts.categoryId,
      sortOrder: productCategoryProducts.sortOrder,
    })
    .from(productCategoryProducts)
    .where(eq(productCategoryProducts.productId, productId))
}

/**
 * Walk up the parent chain from a set of seed category ids, filtering
 * inactive rows. Returns every active row reachable from the seeds.
 *
 * Iterative breadth-first to bound depth and avoid Drizzle recursive-CTE
 * complexity. Real-world category trees are O(depth ≤ 5), so this issues
 * at most a handful of `inArray` lookups regardless of breadth.
 *
 * Cycle-protected via a visited set — a misconfigured parent loop won't
 * spin the indexer.
 */
async function walkActiveCategoryChain(
  db: AnyDrizzleDb,
  seedIds: ReadonlyArray<string>,
): Promise<Map<string, CategoryRow>> {
  const resolved = new Map<string, CategoryRow>()
  const visited = new Set<string>()
  let frontier = Array.from(new Set(seedIds))

  while (frontier.length > 0) {
    for (const id of frontier) visited.add(id)

    const rows = await db
      .select({
        id: productCategories.id,
        parentId: productCategories.parentId,
        name: productCategories.name,
        slug: productCategories.slug,
        active: productCategories.active,
      })
      .from(productCategories)
      .where(and(inArray(productCategories.id, frontier), eq(productCategories.active, true)))

    const nextFrontier: string[] = []
    for (const row of rows) {
      resolved.set(row.id, row)
      if (row.parentId && !visited.has(row.parentId) && !resolved.has(row.parentId)) {
        nextFrontier.push(row.parentId)
      }
    }
    frontier = Array.from(new Set(nextFrontier))
  }

  return resolved
}

interface TagRow {
  id: string
  name: string
}

async function fetchProductTags(db: AnyDrizzleDb, productId: string): Promise<TagRow[]> {
  return db
    .select({ id: productTags.id, name: productTags.name })
    .from(productTagProducts)
    .innerJoin(productTags, eq(productTagProducts.tagId, productTags.id))
    .where(eq(productTagProducts.productId, productId))
}

interface TaxonomyProjection {
  categoryIds: string[]
  categoryNames: string[]
  categorySlugs: string[]
  primaryCategoryId: string | null
  primaryCategoryName: string | null
  primaryCategorySlug: string | null
  tagIds: string[]
  tagLabels: string[]
}

function buildTaxonomyProjection(
  directLinks: ReadonlyArray<DirectCategoryLink>,
  resolvedCategories: ReadonlyMap<string, CategoryRow>,
  tags: ReadonlyArray<TagRow>,
): TaxonomyProjection {
  // Primary = first direct link (by sortOrder asc, then category name asc)
  // that resolved as active. If every direct link is inactive, primary is
  // null even when ancestors are active — the badge represents what the
  // operator pinned.
  const sortedDirect = [...directLinks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    const nameA = resolvedCategories.get(a.categoryId)?.name ?? ""
    const nameB = resolvedCategories.get(b.categoryId)?.name ?? ""
    return nameA.localeCompare(nameB)
  })

  let primary: CategoryRow | null = null
  for (const link of sortedDirect) {
    const row = resolvedCategories.get(link.categoryId)
    if (row) {
      primary = row
      break
    }
  }

  // Categories[] = direct links + ancestors, deduped, ordered by direct-link
  // sortOrder first then ancestor walk order. Stable enough that storefronts
  // can rely on `categories[0]` being a representative label.
  const seenIds = new Set<string>()
  const categoryIds: string[] = []
  const categoryNames: string[] = []
  const categorySlugs: string[] = []

  function emit(row: CategoryRow): void {
    if (seenIds.has(row.id)) return
    seenIds.add(row.id)
    categoryIds.push(row.id)
    categoryNames.push(row.name)
    categorySlugs.push(row.slug)
  }

  // Pass 1: direct links first, in operator-controlled order.
  for (const link of sortedDirect) {
    const row = resolvedCategories.get(link.categoryId)
    if (row) emit(row)
  }

  // Pass 2: ancestors of direct links, walking up via parentId.
  for (const link of sortedDirect) {
    let cursor = resolvedCategories.get(link.categoryId)?.parentId ?? null
    const guard = new Set<string>() // local guard against malformed loops
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor)
      const parentRow = resolvedCategories.get(cursor)
      if (!parentRow) break
      emit(parentRow)
      cursor = parentRow.parentId
    }
  }

  return {
    categoryIds,
    categoryNames,
    categorySlugs,
    primaryCategoryId: primary?.id ?? null,
    primaryCategoryName: primary?.name ?? null,
    primaryCategorySlug: primary?.slug ?? null,
    tagIds: tags.map((t) => t.id),
    tagLabels: tags.map((t) => t.name),
  }
}

/**
 * Construct the taxonomy projection extension.
 *
 * Returns a `ProductProjectionExtension` ready to pass to
 * `createProductDocumentBuilder`.
 */
export function createProductTaxonomyProjectionExtension(): ProductProjectionExtension {
  return {
    name: "products:taxonomy",
    async project(db, productId, _slice) {
      const [directLinks, tags] = await Promise.all([
        fetchDirectCategoryLinks(db, productId),
        fetchProductTags(db, productId),
      ])

      const seedIds = directLinks.map((l) => l.categoryId)
      const resolvedCategories =
        seedIds.length > 0
          ? await walkActiveCategoryChain(db, seedIds)
          : new Map<string, CategoryRow>()

      const projection = buildTaxonomyProjection(directLinks, resolvedCategories, tags)

      return new Map<string, unknown>([
        ["categories[]", projection.categoryNames],
        ["categoryIds[]", projection.categoryIds],
        ["categorySlugs[]", projection.categorySlugs],
        ["primaryCategoryId", projection.primaryCategoryId],
        ["primaryCategoryName", projection.primaryCategoryName],
        ["primaryCategorySlug", projection.primaryCategorySlug],
        ["tagLabels[]", projection.tagLabels],
        ["tagIds[]", projection.tagIds],
      ])
    },
  }
}

// Internal exports for unit tests — kept separate from the public surface.
export const __test__ = {
  buildTaxonomyProjection,
}
