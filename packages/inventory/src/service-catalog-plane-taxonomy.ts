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
 * Localization (#502): when a `product_category_translations` /
 * `product_tag_translations` row exists for the slice's locale, its `name`
 * wins. Otherwise the projection falls back to the canonical
 * `productCategories.name` / `productTags.name` (the legacy single-locale
 * column). This makes the upgrade non-breaking — operators that haven't
 * created translations keep seeing the English label on every locale slice
 * exactly as before.
 *
 * Slugs stay single-locale on `productCategories.slug` (per #502 non-goals
 * — operators want stable URLs that don't shift when translations are
 * edited).
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, inArray } from "drizzle-orm"

import {
  productCategories,
  productCategoryProducts,
  productCategoryTranslations,
  productTagProducts,
  productTags,
  productTagTranslations,
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

/**
 * Look up locale-specific category names for the given category ids. Returns
 * a Map keyed by category id; entries only exist when a translation row was
 * found for the slice locale. Callers fall back to the canonical
 * `productCategories.name` for any missing entry.
 */
async function fetchCategoryTranslations(
  db: AnyDrizzleDb,
  categoryIds: ReadonlyArray<string>,
  languageTag: string,
): Promise<Map<string, string>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await db
    .select({
      categoryId: productCategoryTranslations.categoryId,
      name: productCategoryTranslations.name,
    })
    .from(productCategoryTranslations)
    .where(
      and(
        inArray(productCategoryTranslations.categoryId, categoryIds),
        eq(productCategoryTranslations.languageTag, languageTag),
      ),
    )
  const out = new Map<string, string>()
  for (const row of rows) out.set(row.categoryId, row.name)
  return out
}

async function fetchTagTranslations(
  db: AnyDrizzleDb,
  tagIds: ReadonlyArray<string>,
  languageTag: string,
): Promise<Map<string, string>> {
  if (tagIds.length === 0) return new Map()
  const rows = await db
    .select({
      tagId: productTagTranslations.tagId,
      name: productTagTranslations.name,
    })
    .from(productTagTranslations)
    .where(
      and(
        inArray(productTagTranslations.tagId, tagIds),
        eq(productTagTranslations.languageTag, languageTag),
      ),
    )
  const out = new Map<string, string>()
  for (const row of rows) out.set(row.tagId, row.name)
  return out
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

/**
 * Pure aggregation kernel. `categoryNameByLocale` and `tagNameByLocale`
 * carry slice-locale translations; entries override the canonical name on
 * the row. Missing entries fall back to the canonical name. Slug stays
 * canonical regardless — there's no per-locale slug.
 */
function buildTaxonomyProjection(
  directLinks: ReadonlyArray<DirectCategoryLink>,
  resolvedCategories: ReadonlyMap<string, CategoryRow>,
  tags: ReadonlyArray<TagRow>,
  categoryNameByLocale: ReadonlyMap<string, string> = new Map(),
  tagNameByLocale: ReadonlyMap<string, string> = new Map(),
): TaxonomyProjection {
  // Primary = first direct link (by sortOrder asc, then category name asc)
  // that resolved as active. Tie-break uses the canonical row name so the
  // ordering is stable across slice locales — a translation that sorts
  // differently shouldn't shuffle which category is "primary".
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
    // Locale override wins; otherwise use the canonical row.name.
    categoryNames.push(categoryNameByLocale.get(row.id) ?? row.name)
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
    primaryCategoryName: primary ? (categoryNameByLocale.get(primary.id) ?? primary.name) : null,
    primaryCategorySlug: primary?.slug ?? null,
    tagIds: tags.map((t) => t.id),
    tagLabels: tags.map((t) => tagNameByLocale.get(t.id) ?? t.name),
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
    async project(db, productId, slice) {
      const [directLinks, tags] = await Promise.all([
        fetchDirectCategoryLinks(db, productId),
        fetchProductTags(db, productId),
      ])

      const seedIds = directLinks.map((l) => l.categoryId)
      const resolvedCategories =
        seedIds.length > 0
          ? await walkActiveCategoryChain(db, seedIds)
          : new Map<string, CategoryRow>()

      // Translations cover the FULL chain (direct + ancestors), so look up
      // by every resolved-category id, not just the seed set.
      const allCategoryIds = Array.from(resolvedCategories.keys())
      const tagIds = tags.map((t) => t.id)

      const [categoryNameByLocale, tagNameByLocale] = await Promise.all([
        fetchCategoryTranslations(db, allCategoryIds, slice.locale),
        fetchTagTranslations(db, tagIds, slice.locale),
      ])

      const projection = buildTaxonomyProjection(
        directLinks,
        resolvedCategories,
        tags,
        categoryNameByLocale,
        tagNameByLocale,
      )

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
