/**
 * Field-policy contract for the catalog plane.
 *
 * Every field on every CatalogEntry, in every vertical, is declared with a
 * `FieldPolicy` row. The contract has 12 attributes (one path identifier plus
 * 11 governance attributes) and is intentionally flat and serializable.
 *
 * See `docs/architecture/catalog-architecture.md` §4 for the full design.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Governance enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five field classes. Determines how a field is treated by the overlay
 * resolver, the indexer, and the drift detector.
 *
 * - `managed`           — not user-overrideable; covers external-source-fed
 *                         AND system-managed identity fields
 * - `structural`        — overrideable with constraints; drives search facets
 * - `merchandisable`    — freely overrideable copy, media, marketing fields
 * - `volatile-indexed`  — cached projection with TTL; safe to be slightly stale
 * - `volatile-live`     — never indexed as a live value; always fetched on demand
 */
export type FieldClass =
  | "managed"
  | "structural"
  | "merchandisable"
  | "volatile-indexed"
  | "volatile-live"

/**
 * How an overlay merges with the source projection at read time.
 *
 * - `source-only`    — overlay forbidden even if the class would allow it
 * - `replace`        — override fully replaces the source value
 * - `additive-set`   — override unions with the source (set semantics, e.g. tags)
 * - `additive-list`  — override appends to the source list
 * - `list-position`  — sparse override per list position (e.g. gallery[2].caption)
 */
export type MergeRule =
  | "source-only"
  | "replace"
  | "additive-set"
  | "additive-list"
  | "list-position"

/**
 * Severity for source-side drift events. Drives notification routing and,
 * for `critical`, blocks new bookings on the affected entity until ops
 * acknowledges.
 */
export type DriftSeverity = "none" | "low" | "medium" | "high" | "critical"

/**
 * What scope of search-index documents to re-enqueue when this field
 * mutates.
 *
 * - `none`              — never reindex on this field's changes
 * - `entry`             — reindex this entity across all variant slices
 * - `entry-locale`      — reindex this entity for the affected locale only
 * - `facet-affecting`   — reindex this entity AND propagate facet aggregations
 * - `global`            — bulk reindex required (rare; identity changes)
 */
export type ReindexScope = "none" | "entry" | "entry-locale" | "facet-affecting" | "global"

/**
 * When this field's value should be captured into the booking snapshot.
 *
 * - `never`              — never snapshotted
 * - `on-quote`           — captured at quote/offer creation
 * - `on-book`            — captured at booking commit
 * - `on-quote-and-book`  — captured at both
 */
export type SnapshotMode = "never" | "on-quote" | "on-book" | "on-quote-and-book"

/**
 * Where this field's value lives for query purposes.
 *
 * - `blob-only`            — stored, not indexed; only retrievable as part of the row
 * - `indexed-column`       — indexed in the search engine for filter/sort/facet
 * - `first-class-table`    — promoted to its own column or table for SQL queries
 */
export type Queryability = "blob-only" | "indexed-column" | "first-class-table"

/**
 * Visibility audiences, aligned with the Voyant `Actor` type. A field is
 * visible to an actor only if their audience is in this set.
 *
 * Default deployments use only `staff` and `customer`. Scale-stage deployments
 * add `partner` and `supplier` as the operator's surface area grows.
 */
export type Visibility = "staff" | "customer" | "partner" | "supplier"

/**
 * Which editor role can write overlays for this field. `none` means the field
 * is not user-editable through the overlay store regardless of class.
 */
export type EditRole = "none" | "marketing" | "ops" | "finance" | "admin"

/**
 * UX-level friction applied to overlay writes on this field. The catalog
 * plane stores this as policy; the consuming surface (admin UI, CMS plugin)
 * is responsible for rendering the friction.
 *
 * - `none`      — save-and-go
 * - `confirm`   — confirmation dialog before commit
 * - `approval`  — staged write requiring sign-off before going live
 */
export type OverrideFriction = "none" | "confirm" | "approval"

/**
 * How the source side of this field refreshes. `null` means the field has no
 * source side at all (purely editorial).
 *
 * - `sync`      — periodic batch pull from source
 * - `event`     — push from source via webhook
 * - `request`   — fetched on read (live API call)
 * - `static`    — set once at creation, never refreshes (system-managed identity)
 * - `null`      — no source side at all (purely editorial fields)
 */
export type SourceFreshness = "sync" | "event" | "request" | "static" | null

// ─────────────────────────────────────────────────────────────────────────────
// FieldPolicy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The 12-attribute governance contract for a single CatalogEntry field.
 *
 * Path syntax:
 *   - `field`
 *   - `field.subfield`
 *   - `list[]`
 *   - `list[].field`
 *   - `list[].nested.field`
 *
 * Inheritance (when a leaf is declared without explicit values for some axes):
 *   - Non-inheriting (must be explicit per leaf):
 *     `class`, `merge`, `editRole`, `overrideFriction`, `snapshot`
 *   - Inheriting (default to nearest declared ancestor):
 *     `drift`, `reindex`, `query`, `localized`, `visibility`, `sourceFreshness`
 */
export interface FieldPolicy {
  /** Dotted path; supports `gallery[]`, `geography.countries[].name`. */
  path: string
  class: FieldClass
  merge: MergeRule
  drift: DriftSeverity
  reindex: ReindexScope
  snapshot: SnapshotMode
  query: Queryability
  /** Whether this field has per-locale variants. */
  localized: boolean
  /** Audiences that can see this field. Multiple values: a set, not an enum. */
  visibility: Visibility[]
  editRole: EditRole
  overrideFriction: OverrideFriction
  sourceFreshness: SourceFreshness
}

// ─────────────────────────────────────────────────────────────────────────────
// Inheritance loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-axis inheritance rules. `class`, `merge`, `editRole`, `overrideFriction`,
 * and `snapshot` must be explicit on every leaf — they cannot safely inherit
 * because composite parents commonly have mixed values across children.
 */
const NON_INHERITING_AXES = [
  "class",
  "merge",
  "editRole",
  "overrideFriction",
  "snapshot",
] as const satisfies readonly (keyof FieldPolicy)[]

const INHERITING_AXES = [
  "drift",
  "reindex",
  "query",
  "localized",
  "visibility",
  "sourceFreshness",
] as const satisfies readonly (keyof FieldPolicy)[]

/**
 * A partial field-policy declaration: every axis is optional except `path`
 * and `class`. Inheriting axes default to the nearest declared ancestor;
 * non-inheriting axes that are missing trigger a build-time error.
 */
export type FieldPolicyInput = { path: string } & Partial<Omit<FieldPolicy, "path">> &
  Pick<FieldPolicy, "class">

/**
 * Error raised when the field-policy registry has structural problems —
 * duplicate paths, missing non-inheriting axes, malformed paths.
 */
export class FieldPolicyError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
  ) {
    super(message)
    this.name = "FieldPolicyError"
  }
}

/**
 * Resolves a list of partial policy declarations into fully-specified
 * `FieldPolicy` rows by applying per-axis inheritance from declared ancestors.
 *
 * Non-inheriting axes (class, merge, editRole, overrideFriction, snapshot)
 * must be present on every leaf; missing ones throw `FieldPolicyError`.
 *
 * Inheriting axes (drift, reindex, query, localized, visibility,
 * sourceFreshness) fall back to the nearest declared ancestor along the
 * path tree. If no ancestor declares them, defaults from `INHERITING_DEFAULTS`
 * apply.
 */
export function defineFieldPolicy(inputs: FieldPolicyInput[]): FieldPolicy[] {
  validateNoDuplicatePaths(inputs)
  validatePathSyntax(inputs)

  // Index inputs by path for quick ancestor lookup.
  const byPath = new Map<string, FieldPolicyInput>()
  for (const input of inputs) {
    byPath.set(input.path, input)
  }

  return inputs.map((input) => resolveFieldPolicy(input, byPath))
}

function validateNoDuplicatePaths(inputs: FieldPolicyInput[]): void {
  const seen = new Set<string>()
  for (const input of inputs) {
    if (seen.has(input.path)) {
      throw new FieldPolicyError(`duplicate field-policy path: ${input.path}`, input.path)
    }
    seen.add(input.path)
  }
}

const PATH_SEGMENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\[\])?$/

function validatePathSyntax(inputs: FieldPolicyInput[]): void {
  for (const input of inputs) {
    const segments = input.path.split(".")
    for (const segment of segments) {
      if (!PATH_SEGMENT_RE.test(segment)) {
        throw new FieldPolicyError(
          `invalid path segment "${segment}" in path "${input.path}"`,
          input.path,
        )
      }
    }
  }
}

const INHERITING_DEFAULTS: {
  [K in (typeof INHERITING_AXES)[number]]: FieldPolicy[K]
} = {
  drift: "none",
  reindex: "none",
  query: "blob-only",
  localized: false,
  visibility: ["staff"],
  sourceFreshness: null,
}

function resolveFieldPolicy(
  input: FieldPolicyInput,
  byPath: Map<string, FieldPolicyInput>,
): FieldPolicy {
  // Validate non-inheriting axes are present on this leaf.
  for (const axis of NON_INHERITING_AXES) {
    if (input[axis] === undefined) {
      throw new FieldPolicyError(
        `field "${input.path}" is missing required axis "${axis}" (non-inheriting axes must be explicit on every leaf)`,
        input.path,
      )
    }
  }

  // For inheriting axes, walk up the ancestor chain looking for a declared
  // value. If none, use the global default.
  const ancestors = ancestorPaths(input.path)
  const resolved: Partial<FieldPolicy> = { ...input, path: input.path }

  for (const axis of INHERITING_AXES) {
    if (resolved[axis] !== undefined) continue
    let foundAncestorValue = false
    for (const ancestorPath of ancestors) {
      const ancestor = byPath.get(ancestorPath)
      if (ancestor && ancestor[axis] !== undefined) {
        assignResolvedAxis(resolved, axis, ancestor[axis])
        foundAncestorValue = true
        break
      }
    }
    if (!foundAncestorValue) {
      assignResolvedAxis(resolved, axis, INHERITING_DEFAULTS[axis])
    }
  }

  return resolved as FieldPolicy
}

function assignResolvedAxis<K extends keyof FieldPolicy>(
  target: Partial<FieldPolicy>,
  axis: K,
  value: FieldPolicy[K],
): void {
  target[axis] = value
}

/**
 * Returns the ancestor paths of a given path, ordered from nearest to furthest.
 *
 * Examples:
 *   "gallery[].caption"   → ["gallery[]"]
 *   "geography.countries[].name" → ["geography.countries[]", "geography"]
 *   "title" → []
 */
export function ancestorPaths(path: string): string[] {
  const segments = path.split(".")
  const ancestors: string[] = []
  for (let i = segments.length - 1; i > 0; i--) {
    ancestors.push(segments.slice(0, i).join("."))
  }
  return ancestors
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indexed view of a field-policy registry. Constructed once per vertical at
 * load time; consumed by the resolver, indexer, and drift detector.
 */
export interface FieldPolicyRegistry {
  policies: ReadonlyArray<FieldPolicy>
  byPath: ReadonlyMap<string, FieldPolicy>
  /**
   * Returns the most-specific policy whose path matches `lookupPath`. Path
   * precedence: exact match wins; element path beats collection path;
   * collection path beats ancestor object path; finally, fallback to parent.
   */
  resolve(lookupPath: string): FieldPolicy | undefined
}

export function createFieldPolicyRegistry(policies: FieldPolicy[]): FieldPolicyRegistry {
  const byPath = new Map<string, FieldPolicy>()
  for (const policy of policies) {
    byPath.set(policy.path, policy)
  }

  return {
    policies,
    byPath,
    resolve(lookupPath: string): FieldPolicy | undefined {
      // Exact match.
      const exact = byPath.get(lookupPath)
      if (exact) return exact

      // Walk ancestor chain (nearest first).
      for (const ancestor of ancestorPaths(lookupPath)) {
        const policy = byPath.get(ancestor)
        if (policy) return policy
      }

      return undefined
    },
  }
}
