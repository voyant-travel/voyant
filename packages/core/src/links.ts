/**
 * Module Links — cross-module associations that live in "neutral territory"
 * outside any specific module's schema.
 *
 * Each link defines a pivot table that contains only ID pairs. There are no
 * DB-level foreign key constraints, so modules remain independently
 * swappable, and templates can introduce new cross-module references
 * without modifying any module package.
 */

/**
 * Metadata describing a linkable entity — the entity kind that can participate
 * in a link from another module.
 *
 * Each module exposes one {@link LinkableDefinition} per entity it wants to
 * expose to other modules (e.g. a CRM module exposes `person` and
 * `organization`).
 */
export interface LinkableDefinition {
  /** Owning module name (e.g. "crm"). */
  module: string
  /** Entity name within the module (e.g. "person"). Used to build the join-column name. */
  entity: string
  /** Underlying DB table name (informational; used by codegen / diagnostics). */
  table: string
  /** Primary-key column name on the entity's table. Defaults to "id". */
  primaryKey?: string
  /** TypeID prefix for IDs of this entity (informational). */
  idPrefix?: string
}

/**
 * One side of a link. `isList: true` means that, from the opposite side,
 * this entity appears as a list.
 */
export interface LinkSide {
  linkable: LinkableDefinition
  isList?: boolean
}

export type LinkSideInput = LinkableDefinition | LinkSide

export interface LinkDefinitionOptions {
  /**
   * When true, deleting the link row should cascade-delete the target side
   * (enforced by the link service, not the database).
   */
  deleteCascade?: boolean
  database?: {
    /** Override the auto-generated pivot table name. */
    tableName?: string
    /** Override the auto-generated left-side ID column name. */
    leftColumn?: string
    /** Override the auto-generated right-side ID column name. */
    rightColumn?: string
  }
  /**
   * Mark the link as externally-owned and non-materialized.
   *
   * Read-only links participate in cross-module query traversal, but they do
   * not create a neutral-territory pivot table and cannot be mutated through
   * the runtime link service.
   */
  readOnly?: {
    list(filter?: { leftId?: string; rightId?: string }): Promise<LinkRow[]>
  }
}

export type LinkCardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"

/**
 * A fully-resolved link definition. Produced by {@link defineLink} and
 * consumed by codegen (`generateLinkTableSql`) and the runtime link service.
 */
export interface LinkDefinition {
  left: LinkSide
  right: LinkSide
  /** Generated pivot table name (e.g. "crm_person_products_product"). */
  tableName: string
  /** Left-side ID column name in the pivot table (e.g. "crm_person_id"). */
  leftColumn: string
  /** Right-side ID column name in the pivot table (e.g. "products_product_id"). */
  rightColumn: string
  /** Inferred cardinality from the `isList` flags on each side. */
  cardinality: LinkCardinality
  deleteCascade: boolean
  /**
   * Read-only links are resolved from an externally-owned relation instead of
   * a generated pivot table.
   */
  readOnly?: {
    list(filter?: { leftId?: string; rightId?: string }): Promise<LinkRow[]>
  }
}

/**
 * Declare a link between two linkable entities.
 *
 * @example
 * ```ts
 * // one-to-one
 * defineLink(crm.linkable.person, products.linkable.product)
 *
 * // one-to-many (each person has many products)
 * defineLink(
 *   crm.linkable.person,
 *   { linkable: products.linkable.product, isList: true },
 * )
 *
 * // many-to-many
 * defineLink(
 *   { linkable: crm.linkable.person, isList: true },
 *   { linkable: products.linkable.product, isList: true },
 * )
 * ```
 */
export function defineLink(
  left: LinkSideInput,
  right: LinkSideInput,
  options?: LinkDefinitionOptions,
): LinkDefinition {
  const leftSide = normalizeSide(left)
  const rightSide = normalizeSide(right)

  const tableName = options?.database?.tableName ?? defaultLinkTableName(leftSide, rightSide)
  const leftColumn = options?.database?.leftColumn ?? defaultColumnName(leftSide)
  const rightColumn = options?.database?.rightColumn ?? defaultColumnName(rightSide)

  if (leftColumn === rightColumn) {
    throw new Error(
      `defineLink: left and right column names would collide ("${leftColumn}"). ` +
        `Provide distinct database.leftColumn / database.rightColumn overrides.`,
    )
  }

  return {
    left: leftSide,
    right: rightSide,
    tableName,
    leftColumn,
    rightColumn,
    cardinality: cardinalityFor(leftSide, rightSide),
    deleteCascade: options?.deleteCascade ?? false,
    readOnly: options?.readOnly,
  }
}

function normalizeSide(input: LinkSideInput): LinkSide {
  if ("linkable" in input) {
    return { linkable: input.linkable, isList: input.isList ?? false }
  }
  return { linkable: input, isList: false }
}

function defaultLinkTableName(left: LinkSide, right: LinkSide): string {
  return `${left.linkable.module}_${left.linkable.entity}_${right.linkable.module}_${right.linkable.entity}`
}

function defaultColumnName(side: LinkSide): string {
  return `${side.linkable.module}_${side.linkable.entity}_id`
}

function cardinalityFor(left: LinkSide, right: LinkSide): LinkCardinality {
  if (!left.isList && !right.isList) return "one-to-one"
  if (!left.isList && right.isList) return "one-to-many"
  if (left.isList && !right.isList) return "many-to-one"
  return "many-to-many"
}

/**
 * SQL DDL for materializing a link's pivot table.
 */
export interface LinkTableSql {
  /** `CREATE TABLE IF NOT EXISTS …` statement. */
  createTable: string
  /** `CREATE [UNIQUE] INDEX IF NOT EXISTS …` statements. */
  indexes: string[]
}

/**
 * Generate the SQL needed to materialize a link's pivot table.
 *
 * Columns: `id` (primary key), `<left>_id`, `<right>_id`, `created_at`,
 * `updated_at`, `deleted_at`. Unique indexes are created based on the
 * link's cardinality so the database enforces the relationship shape.
 */
export function generateLinkTableSql(def: LinkDefinition): LinkTableSql {
  if (def.readOnly) {
    throw new Error(
      `generateLinkTableSql: read-only link "${def.tableName}" is externally owned and does not materialize a pivot table`,
    )
  }

  const { tableName, leftColumn, rightColumn } = def

  const createTable = [
    `CREATE TABLE IF NOT EXISTS "${tableName}" (`,
    `  "id" text PRIMARY KEY NOT NULL,`,
    `  "${leftColumn}" text NOT NULL,`,
    `  "${rightColumn}" text NOT NULL,`,
    `  "created_at" timestamp with time zone DEFAULT now() NOT NULL,`,
    `  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,`,
    `  "deleted_at" timestamp with time zone`,
    `)`,
  ].join("\n")

  // Postgres truncates identifiers at 63 chars; keep index suffixes short.
  const indexes: string[] = []

  // Dedupe the pair (ignoring soft-deleted rows).
  indexes.push(
    `CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_pair_idx" ON "${tableName}" ("${leftColumn}", "${rightColumn}") WHERE "deleted_at" IS NULL`,
  )

  // !right.isList → each left has ≤1 right → left_id must be unique.
  if (!def.right.isList) {
    indexes.push(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_l_uniq" ON "${tableName}" ("${leftColumn}") WHERE "deleted_at" IS NULL`,
    )
  } else {
    indexes.push(
      `CREATE INDEX IF NOT EXISTS "${tableName}_l_idx" ON "${tableName}" ("${leftColumn}") WHERE "deleted_at" IS NULL`,
    )
  }

  // !left.isList → each right has ≤1 left → right_id must be unique.
  if (!def.left.isList) {
    indexes.push(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_r_uniq" ON "${tableName}" ("${rightColumn}") WHERE "deleted_at" IS NULL`,
    )
  } else {
    indexes.push(
      `CREATE INDEX IF NOT EXISTS "${tableName}_r_idx" ON "${tableName}" ("${rightColumn}") WHERE "deleted_at" IS NULL`,
    )
  }

  return { createTable, indexes }
}

/**
 * Medusa-style link spec keyed by module name, then by join-column name.
 *
 * @example
 * ```ts
 * {
 *   crm: { person_id: "pers_abc" },
 *   products: { product_id: "prod_xyz" },
 * }
 * ```
 */
export type LinkKeyRecord = Record<string, string>
export type LinkSpec = Record<string, LinkKeyRecord>

export interface ResolvedLinkSpec {
  definition: LinkDefinition
  leftId: string
  rightId: string
}

/**
 * Match a {@link LinkSpec} to a {@link LinkDefinition} from the provided list,
 * returning the matched definition along with the resolved left/right IDs
 * (in the order the definition declares).
 *
 * Throws when the spec doesn't match exactly one definition.
 */
export function resolveLinkFromSpec(spec: LinkSpec, defs: LinkDefinition[]): ResolvedLinkSpec {
  const entries = Object.entries(spec)
  if (entries.length !== 2) {
    throw new Error(`resolveLinkFromSpec: expected exactly 2 module keys, got ${entries.length}`)
  }

  const [first, second] = entries as [[string, LinkKeyRecord], [string, LinkKeyRecord]]

  for (const def of defs) {
    const leftModule = def.left.linkable.module
    const rightModule = def.right.linkable.module
    const leftKey = `${def.left.linkable.entity}_id`
    const rightKey = `${def.right.linkable.entity}_id`

    // Spec order matches definition order.
    if (first[0] === leftModule && second[0] === rightModule) {
      const leftId = first[1][leftKey]
      const rightId = second[1][rightKey]
      if (leftId && rightId) return { definition: def, leftId, rightId }
    }

    // Spec order is reversed.
    if (second[0] === leftModule && first[0] === rightModule) {
      const leftId = second[1][leftKey]
      const rightId = first[1][rightKey]
      if (leftId && rightId) return { definition: def, leftId, rightId }
    }
  }

  throw new Error(
    `resolveLinkFromSpec: no LinkDefinition matches spec keys [${first[0]}, ${second[0]}]`,
  )
}

/**
 * A row in a link's pivot table.
 */
export interface LinkRow {
  id: string
  leftId: string
  rightId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * Filter for {@link LinkService.list}. All provided fields are ANDed.
 *
 * The plural fields (`leftIds`/`rightIds`) match any of the given IDs in a
 * single batched lookup — implementations MUST resolve them with one
 * query/roundtrip, not one per ID. An empty array can never match and
 * short-circuits to `[]`. Singular and plural fields for the same side
 * combine by intersection.
 */
export interface LinkListFilter {
  /** Match a single left-side ID. */
  leftId?: string
  /** Match a single right-side ID. */
  rightId?: string
  /** Match any of the given left-side IDs (one batched query). */
  leftIds?: string[]
  /** Match any of the given right-side IDs (one batched query). */
  rightIds?: string[]
}

/**
 * Runtime service for manipulating link rows. Templates register an
 * implementation in the module container under `"link"`.
 */
export interface LinkService {
  /** Create a link between two entity IDs. Idempotent on the unique pair. */
  create(linkKey: string, leftId: string, rightId: string): Promise<LinkRow>
  /** Create using a Medusa-style module-keyed spec. */
  create(spec: LinkSpec): Promise<LinkRow>

  /** Soft-delete a link (sets `deleted_at`). */
  dismiss(linkKey: string, leftId: string, rightId: string): Promise<void>
  dismiss(spec: LinkSpec): Promise<void>

  /** Hard-delete a link row. */
  delete(linkKey: string, leftId: string, rightId: string): Promise<void>
  delete(spec: LinkSpec): Promise<void>

  /** List link rows matching the given filter (non-soft-deleted only). */
  list(linkKey: string, filter?: LinkListFilter): Promise<LinkRow[]>
}
