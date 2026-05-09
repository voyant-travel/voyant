// Predicate DSL — the structured `where` filter on EventFilterDeclaration.
//
// Closed grammar of 12 operators, evaluated against the standard
// EventEnvelope shape (`data`, `metadata`, `name`, `emittedAt`). No `eval`,
// no Function constructor, no callback-via-network — everything is data.
//
// Authoring shape (from a module's source):
//
//     trigger.on("promotion.changed", {
//       target: bulkReindexProducts,
//       where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
//       input: { ... },
//     })
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §13.1.

// ---- Path / literal references ----

/** Either a path into the envelope or an inline literal value. */
export type PathOrLit = { path: string } | { lit: string | number | boolean | null }

// ---- The grammar ----

export type PredicateExpr =
  | { eq: [PathOrLit, PathOrLit] }
  | { neq: [PathOrLit, PathOrLit] }
  | { in: [PathOrLit, PathOrLit[]] }
  | { gt: [PathOrLit, PathOrLit] }
  | { gte: [PathOrLit, PathOrLit] }
  | { lt: [PathOrLit, PathOrLit] }
  | { lte: [PathOrLit, PathOrLit] }
  | { exists: PathOrLit }
  | { not: PredicateExpr }
  | { and: PredicateExpr[] }
  | { or: PredicateExpr[] }

// ---- Envelope view (what paths address into) ----

/**
 * Minimal structural envelope the evaluator reads. Matches the standard
 * `EventEnvelope` from `@voyantjs/core`. Declared structurally here so the
 * SDK package stays a leaf.
 */
export interface PredicateEnvelope<TData = unknown> {
  name: string
  data: TData
  metadata?: Record<string, unknown> | undefined
  emittedAt: string
}

// ---- Public API ----

/**
 * Evaluate a predicate against an event envelope. Returns `true` / `false`.
 * Path resolution against missing keys yields `undefined`, which makes
 * comparison ops `false` (not throw). The evaluator never throws on data
 * mismatches — registration-time linting catches structural errors via
 * {@link validatePredicate}.
 *
 * Throws `PredicateEvalError` only on unexpected shape errors (the predicate
 * itself was constructed wrong, e.g. malformed operator). Drivers catch
 * this and surface it as `IngestMatch.status === "skipped"` with reason
 * `"where_eval_error"`.
 */
export function evaluatePredicate(expr: PredicateExpr, envelope: PredicateEnvelope): boolean {
  if ("eq" in expr) {
    return strictEquals(resolveSide(expr.eq[0], envelope), resolveSide(expr.eq[1], envelope))
  }
  if ("neq" in expr) {
    return !strictEquals(resolveSide(expr.neq[0], envelope), resolveSide(expr.neq[1], envelope))
  }
  if ("in" in expr) {
    const lhs = resolveSide(expr.in[0], envelope)
    const rhs = expr.in[1].map((item) => resolveSide(item, envelope))
    return rhs.some((candidate) => strictEquals(lhs, candidate))
  }
  if ("gt" in expr) return compareTwo(expr.gt, envelope, ">")
  if ("gte" in expr) return compareTwo(expr.gte, envelope, ">=")
  if ("lt" in expr) return compareTwo(expr.lt, envelope, "<")
  if ("lte" in expr) return compareTwo(expr.lte, envelope, "<=")
  if ("exists" in expr) {
    return resolveSide(expr.exists, envelope) !== undefined
  }
  if ("not" in expr) return !evaluatePredicate(expr.not, envelope)
  if ("and" in expr) {
    if (!Array.isArray(expr.and)) {
      throw new PredicateEvalError("`and` clause must be an array of predicates")
    }
    return expr.and.every((sub) => evaluatePredicate(sub, envelope))
  }
  if ("or" in expr) {
    if (!Array.isArray(expr.or)) {
      throw new PredicateEvalError("`or` clause must be an array of predicates")
    }
    return expr.or.some((sub) => evaluatePredicate(sub, envelope))
  }
  throw new PredicateEvalError(`unknown predicate operator: ${stringify(expr)}`)
}

/**
 * Resolve a path string against an envelope. Public so consumers (input
 * mapper, manifest builder) can share the same path semantics without
 * re-implementing them.
 *
 * Path syntax: dot-separated; `[N]` for array index; missing intermediate
 * keys produce `undefined`. Roots: `data`, `metadata`, `name`, `emittedAt`.
 *
 * Returns `undefined` on any shape mismatch — that's how runtime evaluation
 * stays no-throw.
 */
export function resolvePath(path: string, envelope: PredicateEnvelope): unknown {
  const segments = parsePath(path)
  if (segments.length === 0) return undefined
  const [root, ...rest] = segments
  let value: unknown
  switch (root) {
    case "name":
      value = envelope.name
      break
    case "emittedAt":
      value = envelope.emittedAt
      break
    case "data":
      value = envelope.data
      break
    case "metadata":
      value = envelope.metadata
      break
    default:
      // Unknown roots evaluate to undefined at runtime. Registration-time
      // linter surfaces this as a structural error so callers see it earlier.
      return undefined
  }
  for (const segment of rest) {
    if (value === undefined || value === null) return undefined
    if (typeof segment === "number") {
      if (!Array.isArray(value)) return undefined
      value = value[segment]
    } else {
      if (typeof value !== "object") return undefined
      value = (value as Record<string, unknown>)[segment]
    }
  }
  return value
}

// ---- Static linter (registration-time) ----

export interface PredicateValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Static structural check on a `PredicateExpr`. Catches path roots that
 * aren't `data`/`metadata`/`name`/`emittedAt`, type mismatches on
 * comparison operators (number vs string lhs/rhs), and malformed grammars.
 * Surfaced at `trigger.on()` registration so authoring errors fail fast.
 */
export function validatePredicate(expr: PredicateExpr): PredicateValidationResult {
  const errors: string[] = []
  walk(expr, errors, [])
  return { ok: errors.length === 0, errors }
}

function walk(expr: PredicateExpr, errors: string[], path: string[]): void {
  if (typeof expr !== "object" || expr === null) {
    errors.push(`${pathLabel(path)}: predicate must be an object, got ${typeof expr}`)
    return
  }
  const keys = Object.keys(expr)
  if (keys.length !== 1) {
    errors.push(
      `${pathLabel(path)}: a predicate object must have exactly one operator key, got ${keys.length} (${keys.join(", ")})`,
    )
    return
  }
  const op = keys[0] as keyof PredicateExpr
  switch (op) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const raw = (expr as Record<string, unknown>)[op]
      if (!Array.isArray(raw) || raw.length !== 2) {
        errors.push(`${pathLabel([...path, op])}: expected [lhs, rhs] tuple`)
        return
      }
      const sides = raw as [PathOrLit, PathOrLit]
      validateSide(sides[0], errors, [...path, op, "0"])
      validateSide(sides[1], errors, [...path, op, "1"])
      // Type-sanity for ordered comparisons: both literals must be the same numeric/string flavor.
      if (op !== "eq" && op !== "neq") {
        const lhsLit = sideLitType(sides[0])
        const rhsLit = sideLitType(sides[1])
        if (
          lhsLit !== "unknown" &&
          rhsLit !== "unknown" &&
          lhsLit !== rhsLit &&
          (lhsLit === "number" || lhsLit === "string")
        ) {
          errors.push(
            `${pathLabel([...path, op])}: ordered comparison sides must agree on type (got ${lhsLit} vs ${rhsLit})`,
          )
        }
      }
      return
    }
    case "in": {
      const tuple = (expr as { in: [PathOrLit, PathOrLit[]] }).in
      if (!Array.isArray(tuple) || tuple.length !== 2) {
        errors.push(`${pathLabel([...path, "in"])}: expected [lhs, rhs[]] tuple`)
        return
      }
      validateSide(tuple[0], errors, [...path, "in", "0"])
      if (!Array.isArray(tuple[1])) {
        errors.push(`${pathLabel([...path, "in", "1"])}: rhs must be an array of paths/literals`)
        return
      }
      for (let i = 0; i < tuple[1].length; i++) {
        const s = tuple[1][i] as PathOrLit
        validateSide(s, errors, [...path, "in", "1", String(i)])
      }
      return
    }
    case "exists":
      validateSide((expr as { exists: PathOrLit }).exists, errors, [...path, "exists"])
      return
    case "not":
      walk((expr as { not: PredicateExpr }).not, errors, [...path, "not"])
      return
    case "and":
    case "or": {
      const raw = (expr as Record<string, unknown>)[op]
      if (!Array.isArray(raw)) {
        errors.push(`${pathLabel([...path, op])}: ${op} must be an array of predicates`)
        return
      }
      const arr = raw as PredicateExpr[]
      for (let i = 0; i < arr.length; i++) {
        const sub = arr[i] as PredicateExpr
        walk(sub, errors, [...path, op, String(i)])
      }
      return
    }
    default:
      errors.push(`${pathLabel(path)}: unknown predicate operator "${String(op)}"`)
  }
}

function validateSide(side: PathOrLit, errors: string[], path: string[]): void {
  if (typeof side !== "object" || side === null) {
    errors.push(`${pathLabel(path)}: expected { path } or { lit }, got ${typeof side}`)
    return
  }
  if ("path" in side) {
    if (typeof side.path !== "string" || side.path.length === 0) {
      errors.push(`${pathLabel(path)}: "path" must be a non-empty string`)
      return
    }
    const root = parsePath(side.path)[0]
    if (root !== "data" && root !== "metadata" && root !== "name" && root !== "emittedAt") {
      errors.push(
        `${pathLabel(path)}: path root "${String(root)}" is not one of data | metadata | name | emittedAt`,
      )
    }
    return
  }
  if ("lit" in side) {
    const t = typeof side.lit
    if (t !== "string" && t !== "number" && t !== "boolean" && side.lit !== null) {
      errors.push(`${pathLabel(path)}: lit must be string | number | boolean | null`)
    }
    return
  }
  errors.push(`${pathLabel(path)}: must specify "path" or "lit"`)
}

// ---- Internal helpers ----

class PredicateEvalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PredicateEvalError"
  }
}

function resolveSide(side: PathOrLit, envelope: PredicateEnvelope): unknown {
  if ("lit" in side) return side.lit
  if ("path" in side) return resolvePath(side.path, envelope)
  return undefined
}

function strictEquals(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return false
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === "object") {
    // Strict equality only for primitives + null. Object equality is not
    // supported in v1; users who need it project specific paths to compare.
    return false
  }
  return a === b
}

function compareTwo(
  sides: [PathOrLit, PathOrLit],
  envelope: PredicateEnvelope,
  op: ">" | ">=" | "<" | "<=",
): boolean {
  const lhs = resolveSide(sides[0], envelope)
  const rhs = resolveSide(sides[1], envelope)
  if (lhs === undefined || rhs === undefined) return false
  if (typeof lhs !== typeof rhs) return false
  if (typeof lhs !== "number" && typeof lhs !== "string") return false
  switch (op) {
    case ">":
      return (lhs as number | string) > (rhs as number | string)
    case ">=":
      return (lhs as number | string) >= (rhs as number | string)
    case "<":
      return (lhs as number | string) < (rhs as number | string)
    case "<=":
      return (lhs as number | string) <= (rhs as number | string)
  }
}

function sideLitType(side: PathOrLit): "number" | "string" | "boolean" | "null" | "unknown" {
  if ("lit" in side) {
    if (side.lit === null) return "null"
    const t = typeof side.lit
    if (t === "number" || t === "string" || t === "boolean") return t
  }
  return "unknown"
}

/**
 * Parse a dot-and-bracket path into segments. `data.items[0].id` becomes
 * `["data", "items", 0, "id"]`. Numeric segments inside `[N]` are returned
 * as numbers; everything else as strings. Malformed input yields `[]`.
 */
function parsePath(path: string): Array<string | number> {
  if (typeof path !== "string" || path.length === 0) return []
  const segments: Array<string | number> = []
  let i = 0
  let buf = ""
  const flushBuf = (): void => {
    if (buf.length > 0) {
      segments.push(buf)
      buf = ""
    }
  }
  while (i < path.length) {
    const c = path[i]
    if (c === ".") {
      flushBuf()
      i++
      continue
    }
    if (c === "[") {
      flushBuf()
      const end = path.indexOf("]", i)
      if (end === -1) return []
      const idx = Number(path.slice(i + 1, end))
      if (!Number.isInteger(idx) || idx < 0) return []
      segments.push(idx)
      i = end + 1
      continue
    }
    buf += c
    i++
  }
  flushBuf()
  return segments
}

function pathLabel(path: string[]): string {
  return path.length === 0 ? "(root)" : path.join(".")
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
