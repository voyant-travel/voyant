/**
 * Query Graph — cross-module reads that traverse {@link LinkDefinition}s.
 *
 * Modules expose {@link EntityFetcher}s for their entities. The graph
 * planner fetches base records, walks link definitions for any dotted
 * fields in the selection, issues parallel fetches for the linked
 * entities, and stitches the results in-memory.
 *
 * This is an application-layer join, not a SQL join: modules never
 * import one another's tables, and there are no database foreign keys
 * between module schemas.
 */

import type { LinkDefinition, LinkService } from "./links.js"

/** Filters applied to the underlying entity fetcher. */
export type QueryFilters = Record<string, unknown>
/** Per-request hints threaded through cross-module reads. */
export type QueryContextValue = Record<string, unknown>

export interface QueryPagination {
  skip?: number
  take?: number
}

/** Arguments passed to an {@link EntityFetcher}'s `list` method. */
export interface EntityFetcherArgs {
  filters?: QueryFilters
  ids?: string[]
  pagination?: QueryPagination
  context?: QueryContextValue
}

/**
 * A minimal record shape. Concrete module records can extend this with
 * additional fields; the query planner only requires `id` to join on.
 */
export type EntityRecord = Record<string, unknown> & { id: string }

/**
 * Per-entity data loader. Modules register one fetcher per entity they
 * want to expose to cross-module reads.
 *
 * Implementations MUST honour both the `filters`/`pagination` path
 * (top-level entity fetch) and the `ids` path (used to hydrate link
 * targets). When both are provided, `ids` takes precedence.
 */
export interface EntityFetcher {
  list(args: EntityFetcherArgs): Promise<EntityRecord[]>
}

export interface QueryGraphConfig {
  /** Name of the entity to fetch. Must match a registered fetcher's key. */
  entity: string
  /**
   * Flat list of field paths to select.
   *
   * - `"id"`, `"title"` — scalar fields (ignored by the planner; honoured by the fetcher).
   * - `"products.*"` — traverses the `entity → products` link.
   * - `"organization.name"` — traverses the `entity → organization` link; only `name` is hydrated.
   *
   * Nested paths (`"products.categories.*"`) are NOT supported in the MVP.
   */
  fields: string[]
  filters?: QueryFilters
  pagination?: QueryPagination
  /**
   * Per-request runtime hints such as locale, market, actor, or pricing
   * context. The query planner passes this through unchanged to every
   * participating entity fetcher.
   */
  context?: QueryContextValue
}

export interface QueryGraphResult {
  data: EntityRecord[]
}

/**
 * Callable query runtime exposed to routes and subscribers.
 *
 * It wraps a fixed {@link QueryGraphContext} so callers only supply the
 * per-request graph config.
 */
export type QueryRunner = (config: QueryGraphConfig) => Promise<QueryGraphResult>

export interface QueryGraphContext {
  /** Entity name → fetcher. */
  fetchers: Map<string, EntityFetcher>
  /** Known cross-module link definitions. */
  links: LinkDefinition[]
  /** Runtime link service (pivot table reads). */
  linkService: LinkService
}

/**
 * Build a {@link QueryGraphContext} from plain records.
 */
export function createQueryContext(
  fetchers: Record<string, EntityFetcher>,
  links: LinkDefinition[],
  linkService: LinkService,
): QueryGraphContext {
  return { fetchers: new Map(Object.entries(fetchers)), links, linkService }
}

/**
 * Wrap a fixed {@link QueryGraphContext} in a callable runtime.
 */
export function createQueryRunner(ctx: QueryGraphContext): QueryRunner {
  return (config) => queryGraph(ctx, config)
}

interface RelationPlan {
  relation: string
  subfields: string[]
}

function parseRelations(fields: string[]): RelationPlan[] {
  const map = new Map<string, string[]>()
  for (const field of fields) {
    const dotIdx = field.indexOf(".")
    if (dotIdx === -1) continue
    const relation = field.slice(0, dotIdx)
    const subfield = field.slice(dotIdx + 1)
    const existing = map.get(relation) ?? []
    existing.push(subfield)
    map.set(relation, existing)
  }
  return Array.from(map.entries(), ([relation, subfields]) => ({ relation, subfields }))
}

function findLinkForRelation(
  links: LinkDefinition[],
  entity: string,
  relation: string,
): { def: LinkDefinition; ourSideIsLeft: boolean } | undefined {
  for (const def of links) {
    const leftEntity = def.left.linkable.entity
    const rightEntity = def.right.linkable.entity
    if (leftEntity === entity && rightEntity === relation) {
      return { def, ourSideIsLeft: true }
    }
    if (rightEntity === entity && leftEntity === relation) {
      return { def, ourSideIsLeft: false }
    }
  }
  return undefined
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}

/**
 * Execute a cross-module read.
 *
 * @example
 * ```ts
 * const { data } = await queryGraph(ctx, {
 *   entity: "person",
 *   fields: ["id", "name", "product.*", "organization.name"],
 *   filters: { country: "FR" },
 *   pagination: { take: 50 },
 * })
 * // data[0].product === [{ id: "prod_...", ... }, ...]
 * // data[0].organization === { id: "org_...", name: "..." } | null
 * ```
 */
export async function queryGraph(
  ctx: QueryGraphContext,
  config: QueryGraphConfig,
): Promise<QueryGraphResult> {
  const { fetchers, links, linkService } = ctx
  const { entity, fields, filters, pagination, context } = config

  const baseFetcher = fetchers.get(entity)
  if (!baseFetcher) {
    throw new Error(`queryGraph: no fetcher registered for entity "${entity}"`)
  }

  const plans = parseRelations(fields)
  const baseRecords = await baseFetcher.list({ filters, pagination, context })
  if (baseRecords.length === 0) return { data: [] }

  for (const { relation } of plans) {
    const match = findLinkForRelation(links, entity, relation)
    if (!match) {
      throw new Error(`queryGraph: no link definition found for "${entity}.${relation}"`)
    }

    const { def, ourSideIsLeft } = match
    const targetSide = ourSideIsLeft ? def.right : def.left
    const targetEntity = targetSide.linkable.entity
    const targetIsList = targetSide.isList ?? false

    const targetFetcher = fetchers.get(targetEntity)
    if (!targetFetcher) {
      throw new Error(`queryGraph: no fetcher registered for target entity "${targetEntity}"`)
    }

    // ONE batched link lookup for all base records — per-base fan-out costs
    // a query (and on Workers a subrequest) per record.
    const baseIds = unique(baseRecords.map((r) => r.id))
    const linkRows = await linkService.list(
      def.tableName,
      ourSideIsLeft ? { leftIds: baseIds } : { rightIds: baseIds },
    )

    // baseId → targetIds for stitching. Rows arrive in the link service's
    // list order (created_at ASC), so per-base target order is preserved.
    const idMap = new Map<string, string[]>()
    for (const baseId of baseIds) idMap.set(baseId, [])
    for (const row of linkRows) {
      const baseId = ourSideIsLeft ? row.leftId : row.rightId
      const targetId = ourSideIsLeft ? row.rightId : row.leftId
      idMap.get(baseId)?.push(targetId)
    }

    // Hydrate all target records in one call.
    const allTargetIds = unique(Array.from(idMap.values()).flat())
    const targetRecords =
      allTargetIds.length > 0 ? await targetFetcher.list({ ids: allTargetIds, context }) : []
    const byTargetId = new Map(targetRecords.map((r) => [r.id, r]))

    // Attach to each base record.
    for (const record of baseRecords) {
      const targetIds = idMap.get(record.id) ?? []
      const resolved: EntityRecord[] = []
      for (const targetId of targetIds) {
        const t = byTargetId.get(targetId)
        if (t) resolved.push(t)
      }
      record[relation] = targetIsList ? resolved : (resolved[0] ?? null)
    }
  }

  return { data: baseRecords }
}
