/**
 * Runtime link service backed by Drizzle — executes raw SQL against the
 * dynamically-named pivot tables materialised from {@link LinkDefinition}s.
 */

import type {
  LinkDefinition,
  LinkListFilter,
  LinkRow,
  LinkService,
  LinkSpec,
  ResolvedLinkSpec,
} from "@voyant-travel/core"
import { generateLinkTableSql, resolveLinkFromSpec } from "@voyant-travel/core"
import { sql } from "drizzle-orm"

import { newIdFromPrefix } from "./lib/typeid.js"
import type { DrizzleClient } from "./types.js"

/**
 * TypeID prefix used for link row IDs.
 * Short, fixed, and outside the module-owned prefix list in lib/typeid.ts.
 */
const LINK_ID_PREFIX = "lnk"

type RawLinkRow = {
  id: string
  created_at: Date | string
  updated_at: Date | string
  deleted_at: Date | string | null
  [column: string]: unknown
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

function toNullableDate(v: Date | string | null): Date | null {
  if (v === null) return null
  return v instanceof Date ? v : new Date(v)
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

/**
 * Collapse the singular + plural ID filters for one side into a single
 * constraint:
 *
 * - `undefined` — the side is unconstrained.
 * - `null` — the filter can never match (empty array, or a singular ID that
 *   isn't in the plural set); callers short-circuit to `[]` without querying.
 * - `string[]` — match any of these (deduped) IDs.
 *
 * Falsy singular IDs are ignored, matching the historical truthy check.
 */
function normalizeIdFilter(
  single: string | undefined,
  many: string[] | undefined,
): string[] | null | undefined {
  if (single && many) {
    return many.includes(single) ? [single] : null
  }
  if (single) return [single]
  if (many) {
    const ids = unique(many)
    return ids.length === 0 ? null : ids
  }
  return undefined
}

type ReadOnlyResolver = NonNullable<LinkDefinition["readOnly"]>

type LinkDefinitionIdentity = Pick<LinkDefinition, "tableName" | "leftColumn" | "rightColumn">

const LINK_DEFINITION_IDENTITY_FIELDS = ["tableName", "leftColumn", "rightColumn"] as const

function isNonEmptyStringProperty(
  value: unknown,
  property: (typeof LINK_DEFINITION_IDENTITY_FIELDS)[number],
): boolean {
  if (value === null || typeof value !== "object") return false
  const propertyValue = Reflect.get(value, property)
  return typeof propertyValue === "string" && propertyValue.length > 0
}

function hasLinkDefinitionIdentity(value: unknown): value is LinkDefinitionIdentity {
  return LINK_DEFINITION_IDENTITY_FIELDS.every((field) => isNonEmptyStringProperty(value, field))
}

/**
 * Resolve a (possibly batched) list filter against a read-only link.
 *
 * Read-only resolvers only understand singular `leftId`/`rightId` filters,
 * so a batched filter fans out one resolver call per ID on one side and
 * applies any remaining ID-set constraint locally.
 */
async function listReadOnly(
  ro: ReadOnlyResolver,
  leftIds: string[] | undefined,
  rightIds: string[] | undefined,
): Promise<LinkRow[]> {
  const singleLeft = leftIds && leftIds.length === 1 ? leftIds[0] : undefined
  const singleRight = rightIds && rightIds.length === 1 ? rightIds[0] : undefined

  // At most one ID per side — the resolver's native filter shape.
  if ((!leftIds || singleLeft !== undefined) && (!rightIds || singleRight !== undefined)) {
    const filter: { leftId?: string; rightId?: string } = {}
    if (singleLeft !== undefined) filter.leftId = singleLeft
    if (singleRight !== undefined) filter.rightId = singleRight
    return ro.list(filter)
  }

  const fanLeft = leftIds !== undefined && singleLeft === undefined
  const fanIds = (fanLeft ? leftIds : rightIds) as string[]
  const batches = await Promise.all(
    fanIds.map((id) => {
      const filter: { leftId?: string; rightId?: string } = fanLeft
        ? { leftId: id }
        : { rightId: id }
      if (fanLeft && singleRight !== undefined) filter.rightId = singleRight
      if (!fanLeft && singleLeft !== undefined) filter.leftId = singleLeft
      return ro.list(filter)
    }),
  )
  let rows = batches.flat()
  // Both sides batched — the right-side set couldn't be pushed into the
  // resolver calls, so apply it here.
  if (fanLeft && rightIds && singleRight === undefined) {
    const allowed = new Set(rightIds)
    rows = rows.filter((row) => allowed.has(row.rightId))
  }
  return rows
}

function prepareLinkDefinitions(definitions: readonly LinkDefinition[]): {
  definitions: LinkDefinition[]
  byKey: Map<string, LinkDefinition>
} {
  const prepared = [...definitions]
  const byKey = new Map<string, LinkDefinition>()
  for (const [index, def] of prepared.entries()) {
    if (!hasLinkDefinitionIdentity(def)) {
      const missingFields = LINK_DEFINITION_IDENTITY_FIELDS.filter(
        (field) => !isNonEmptyStringProperty(def, field),
      )
      throw new Error(
        `createLinkService: invalid link definition at index ${index}; missing ${missingFields.join(
          ", ",
        )}`,
      )
    }
    if (byKey.has(def.tableName)) {
      throw new Error(`createLinkService: duplicate link definition for table "${def.tableName}"`)
    }
    byKey.set(def.tableName, def)
  }
  return { definitions: prepared, byKey }
}

function createPreparedLinkService(
  getDb: () => DrizzleClient,
  definitions: LinkDefinition[],
  byKey: Map<string, LinkDefinition>,
): LinkService {
  function lookupByKey(linkKey: string): LinkDefinition {
    const def = byKey.get(linkKey)
    if (!def) {
      throw new Error(`createLinkService: unknown link key "${linkKey}"`)
    }
    return def
  }

  function resolveArgs(
    keyOrSpec: string | LinkSpec,
    leftId?: string,
    rightId?: string,
  ): ResolvedLinkSpec {
    if (typeof keyOrSpec === "string") {
      if (leftId === undefined || rightId === undefined) {
        throw new Error("createLinkService: positional API requires linkKey, leftId, and rightId")
      }
      return { definition: lookupByKey(keyOrSpec), leftId, rightId }
    }
    return resolveLinkFromSpec(keyOrSpec, definitions)
  }

  function rowFromRaw(def: LinkDefinition, raw: RawLinkRow): LinkRow {
    const leftId = raw[def.leftColumn]
    const rightId = raw[def.rightColumn]
    if (typeof leftId !== "string" || typeof rightId !== "string") {
      throw new Error(`createLinkService: malformed row returned from "${def.tableName}"`)
    }
    return {
      id: raw.id,
      leftId,
      rightId,
      createdAt: toDate(raw.created_at),
      updatedAt: toDate(raw.updated_at),
      deletedAt: toNullableDate(raw.deleted_at),
    }
  }

  async function executeRows(query: ReturnType<typeof sql>): Promise<RawLinkRow[]> {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle's execute() return type varies by adapter -- owner: db; existing suppression is intentional pending typed cleanup.
    const result: any = await (getDb() as any).execute(query)
    if (Array.isArray(result)) return result as RawLinkRow[]
    if (result && Array.isArray(result.rows)) return result.rows as RawLinkRow[]
    return []
  }

  async function createImpl(spec: ResolvedLinkSpec): Promise<LinkRow> {
    const { definition: def, leftId, rightId } = spec
    const table = sql.identifier(def.tableName)
    const leftCol = sql.identifier(def.leftColumn)
    const rightCol = sql.identifier(def.rightColumn)
    const id = newIdFromPrefix(LINK_ID_PREFIX)

    // Resurrect any soft-deleted pair first — otherwise the partial unique
    // index would prevent the INSERT, and we'd fail the "idempotent" contract.
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const restoreQuery = sql`UPDATE ${table}
      SET "deleted_at" = NULL, "updated_at" = now()
      WHERE ${leftCol} = ${leftId} AND ${rightCol} = ${rightId} AND "deleted_at" IS NOT NULL
      RETURNING *`
    const restored = await executeRows(restoreQuery)
    if (restored.length > 0 && restored[0]) {
      return rowFromRaw(def, restored[0])
    }

    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const insertQuery = sql`INSERT INTO ${table}
      ("id", ${leftCol}, ${rightCol}, "created_at", "updated_at", "deleted_at")
      VALUES (${id}, ${leftId}, ${rightId}, now(), now(), NULL)
      ON CONFLICT DO NOTHING
      RETURNING *`
    const inserted = await executeRows(insertQuery)
    if (inserted.length > 0 && inserted[0]) {
      return rowFromRaw(def, inserted[0])
    }

    // Conflict — a row (or matching pair) already exists. Fetch the active one.
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const fetchQuery = sql`SELECT * FROM ${table}
      WHERE ${leftCol} = ${leftId} AND ${rightCol} = ${rightId} AND "deleted_at" IS NULL
      LIMIT 1`
    const existing = await executeRows(fetchQuery)
    if (existing.length > 0 && existing[0]) {
      return rowFromRaw(def, existing[0])
    }

    throw new Error(`createLinkService: could not create or find link row in "${def.tableName}"`)
  }

  async function dismissImpl(spec: ResolvedLinkSpec): Promise<void> {
    const { definition: def, leftId, rightId } = spec
    if (def.readOnly) {
      throw new Error(`createLinkService: read-only link "${def.tableName}" cannot be dismissed`)
    }
    const table = sql.identifier(def.tableName)
    const leftCol = sql.identifier(def.leftColumn)
    const rightCol = sql.identifier(def.rightColumn)
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const query = sql`UPDATE ${table}
      SET "deleted_at" = now(), "updated_at" = now()
      WHERE ${leftCol} = ${leftId} AND ${rightCol} = ${rightId} AND "deleted_at" IS NULL`
    await executeRows(query)
  }

  async function deleteImpl(spec: ResolvedLinkSpec): Promise<void> {
    const { definition: def, leftId, rightId } = spec
    if (def.readOnly) {
      throw new Error(`createLinkService: read-only link "${def.tableName}" cannot be deleted`)
    }
    const table = sql.identifier(def.tableName)
    const leftCol = sql.identifier(def.leftColumn)
    const rightCol = sql.identifier(def.rightColumn)
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const query = sql`DELETE FROM ${table}
      WHERE ${leftCol} = ${leftId} AND ${rightCol} = ${rightId}`
    await executeRows(query)
  }

  async function list(linkKey: string, filter: LinkListFilter = {}): Promise<LinkRow[]> {
    const def = lookupByKey(linkKey)

    const leftIds = normalizeIdFilter(filter.leftId, filter.leftIds)
    const rightIds = normalizeIdFilter(filter.rightId, filter.rightIds)
    // A provably-empty filter (e.g. `leftIds: []`) can never match — skip the
    // query (and on Workers, the subrequest) entirely.
    if (leftIds === null || rightIds === null) return []

    if (def.readOnly) {
      return listReadOnly(def.readOnly, leftIds, rightIds)
    }

    const table = sql.identifier(def.tableName)
    const leftCol = sql.identifier(def.leftColumn)
    const rightCol = sql.identifier(def.rightColumn)

    // NOTE: a plain array embedded in a drizzle sql template is flattened
    // into per-element chunks; sql.param() binds it as ONE array parameter,
    // so a batched filter stays a single `col = ANY($1)` query.
    const idClause = (col: ReturnType<typeof sql.identifier>, ids: string[]) =>
      // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      ids.length === 1 ? sql`${col} = ${ids[0]}` : sql`${col} = ANY(${sql.param(ids)})`

    const whereClauses = [sql`"deleted_at" IS NULL`]
    if (leftIds) whereClauses.push(idClause(leftCol, leftIds))
    if (rightIds) whereClauses.push(idClause(rightCol, rightIds))

    // Manually join clauses with AND.
    let whereSql = whereClauses[0] as ReturnType<typeof sql>
    for (let i = 1; i < whereClauses.length; i++) {
      // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      whereSql = sql`${whereSql} AND ${whereClauses[i]}`
    }

    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const query = sql`SELECT * FROM ${table}
      WHERE ${whereSql}
      ORDER BY "created_at" ASC`
    const rows = await executeRows(query)
    return rows.map((r) => rowFromRaw(def, r))
  }

  return {
    async create(keyOrSpec: string | LinkSpec, leftId?: string, rightId?: string) {
      const spec = resolveArgs(keyOrSpec, leftId, rightId)
      if (spec.definition.readOnly) {
        throw new Error(
          `createLinkService: read-only link "${spec.definition.tableName}" cannot be created`,
        )
      }
      return createImpl(spec)
    },
    async dismiss(keyOrSpec: string | LinkSpec, leftId?: string, rightId?: string) {
      return dismissImpl(resolveArgs(keyOrSpec, leftId, rightId))
    },
    async delete(keyOrSpec: string | LinkSpec, leftId?: string, rightId?: string) {
      return deleteImpl(resolveArgs(keyOrSpec, leftId, rightId))
    },
    list,
  } as LinkService
}

/**
 * Prevalidate link definitions once, then build services against request-local
 * database clients without repeating startup validation on every request.
 */
export function createLinkServiceFactory(
  definitions: readonly LinkDefinition[],
): (getDb: () => DrizzleClient) => LinkService {
  const prepared = prepareLinkDefinitions(definitions)
  return (getDb) => createPreparedLinkService(getDb, prepared.definitions, prepared.byKey)
}

/**
 * Create a runtime {@link LinkService} for the given set of link definitions.
 *
 * The service supports both a positional API (`create(linkKey, leftId, rightId)`)
 * and a Medusa-style spec API (`create({ moduleA: { a_id }, moduleB: { b_id } })`).
 *
 * Prefer {@link createLinkServiceFactory} when multiple services share the
 * same definitions, such as one service per HTTP request.
 */
export function createLinkService(
  getDb: () => DrizzleClient,
  definitions: readonly LinkDefinition[],
): LinkService {
  return createLinkServiceFactory(definitions)(getDb)
}

/**
 * Materialise every link definition's pivot table (CREATE TABLE + indexes).
 * Intended for use by a `db:sync-links` CLI command in templates.
 *
 * Runs each DDL statement individually against the provided Drizzle client.
 */
export async function syncLinks(
  db: DrizzleClient,
  definitions: readonly LinkDefinition[],
): Promise<void> {
  for (const def of definitions) {
    if (def.readOnly) continue
    const { createTable, indexes } = generateLinkTableSql(def)
    // biome-ignore lint/suspicious/noExplicitAny: drizzle adapter execute typing varies -- owner: db; existing suppression is intentional pending typed cleanup.
    await (db as any).execute(sql.raw(createTable))
    for (const idx of indexes) {
      // biome-ignore lint/suspicious/noExplicitAny: drizzle adapter execute typing varies -- owner: db; existing suppression is intentional pending typed cleanup.
      await (db as any).execute(sql.raw(idx))
    }
  }
}
