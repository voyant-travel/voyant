// Input mapper DSL — projects a workflow input from an event envelope.
//
// Each `EventFilterDeclaration` carries an optional `input: InputMapper`. At
// ingest time, after the predicate matches, the mapper builds the actual
// input value passed to `driver.trigger(target, input, ...)`. Same path
// roots as the predicate evaluator (`data`, `metadata`, `name`, `emittedAt`).
//
// Variants:
//   * `undefined`              → pass through `envelope.data`
//   * `{ passthrough: true }`  → explicit pass-through of `envelope.data`
//   * `{ path: string }`       → workflow input = the resolved path value
//   * `{ object: {...} }`      → build an object by projecting each key;
//                                 each value is itself an InputMapper or a
//                                 `PathOrLit` for terminal projections
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §13.2.

import { type PathOrLit, type PredicateEnvelope, resolvePath } from "./predicate.js"

// ---- Public types ----

export type InputMapper =
  | undefined
  | { passthrough: true }
  | { path: string }
  | { object: Record<string, InputMapper | PathOrLit> }

// ---- Public API ----

/**
 * Project a workflow input from an event envelope. Mirrors the predicate
 * evaluator's no-throw contract — missing paths produce `undefined` in the
 * output, registration-time linting catches structural errors.
 *
 * Throws `InputMapperError` only on unexpected shape errors (the mapper
 * itself was constructed wrong). Drivers catch and surface this as
 * `IngestMatch.status === "skipped"` with reason `"input_projection_error"`.
 */
export function projectInput(mapper: InputMapper, envelope: PredicateEnvelope): unknown {
  if (mapper === undefined) return envelope.data
  if (typeof mapper !== "object" || mapper === null) {
    throw new InputMapperError(
      `input mapper must be undefined, {passthrough}, {path}, or {object}, got ${typeof mapper}`,
    )
  }
  if ("passthrough" in mapper) {
    if (mapper.passthrough !== true) {
      throw new InputMapperError(`{ passthrough } must be true`)
    }
    return envelope.data
  }
  if ("path" in mapper) {
    if (typeof mapper.path !== "string" || mapper.path.length === 0) {
      throw new InputMapperError(`{ path } must be a non-empty string`)
    }
    return resolvePath(mapper.path, envelope)
  }
  if ("object" in mapper) {
    if (typeof mapper.object !== "object" || mapper.object === null) {
      throw new InputMapperError(`{ object } must map keys to InputMapper | PathOrLit`)
    }
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(mapper.object)) {
      out[key] = projectChild(child, envelope)
    }
    return out
  }
  throw new InputMapperError(
    `input mapper must contain one of passthrough | path | object, got keys: ${Object.keys(mapper).join(", ")}`,
  )
}

// ---- Static linter ----

export interface InputMapperValidationResult {
  ok: boolean
  errors: string[]
}

export function validateInputMapper(mapper: InputMapper): InputMapperValidationResult {
  const errors: string[] = []
  walkValidate(mapper, errors, [])
  return { ok: errors.length === 0, errors }
}

// ---- Internals ----

class InputMapperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InputMapperError"
  }
}

/**
 * Resolve one entry inside `{ object: { ... } }`. The value is either a
 * nested mapper (recurse) or a `PathOrLit` (terminal projection).
 */
function projectChild(child: InputMapper | PathOrLit, envelope: PredicateEnvelope): unknown {
  if (child === undefined) return envelope.data
  if (typeof child !== "object" || child === null) {
    throw new InputMapperError(`nested mapper entry must be an object, got ${typeof child}`)
  }
  // Distinguish PathOrLit (`{ path }` or `{ lit }`) from nested mapper.
  if ("lit" in child) {
    return (child as { lit: unknown }).lit
  }
  // `{ path: "..." }` is shared between PathOrLit and InputMapper — resolve directly.
  if ("path" in child) {
    if (typeof child.path !== "string" || child.path.length === 0) {
      throw new InputMapperError(`nested { path } must be a non-empty string`)
    }
    return resolvePath(child.path, envelope)
  }
  // Otherwise: a nested InputMapper (passthrough / object).
  return projectInput(child as InputMapper, envelope)
}

function walkValidate(mapper: InputMapper, errors: string[], path: string[]): void {
  if (mapper === undefined) return
  if (typeof mapper !== "object" || mapper === null) {
    errors.push(
      `${pathLabel(path)}: input mapper must be undefined or an object, got ${typeof mapper}`,
    )
    return
  }
  const keys = Object.keys(mapper)
  if (keys.length === 0) {
    errors.push(`${pathLabel(path)}: input mapper must specify passthrough | path | object`)
    return
  }
  if ("passthrough" in mapper) {
    if (mapper.passthrough !== true) {
      errors.push(`${pathLabel(path)}: { passthrough } must be true`)
    }
    return
  }
  if ("path" in mapper) {
    if (typeof mapper.path !== "string" || mapper.path.length === 0) {
      errors.push(`${pathLabel(path)}: { path } must be a non-empty string`)
      return
    }
    validatePathRoot(mapper.path, errors, path)
    return
  }
  if ("object" in mapper) {
    if (typeof mapper.object !== "object" || mapper.object === null) {
      errors.push(`${pathLabel(path)}: { object } must map keys to InputMapper | PathOrLit`)
      return
    }
    for (const [k, child] of Object.entries(mapper.object)) {
      validateChild(child, errors, [...path, k])
    }
    return
  }
  errors.push(`${pathLabel(path)}: unknown mapper variant — keys: ${keys.join(", ")}`)
}

function validateChild(child: InputMapper | PathOrLit, errors: string[], path: string[]): void {
  if (child === undefined) return
  if (typeof child !== "object" || child === null) {
    errors.push(`${pathLabel(path)}: nested entry must be an object`)
    return
  }
  if ("lit" in child) {
    const t = typeof (child as { lit: unknown }).lit
    if (
      t !== "string" &&
      t !== "number" &&
      t !== "boolean" &&
      (child as { lit: unknown }).lit !== null
    ) {
      errors.push(`${pathLabel(path)}: { lit } must be string | number | boolean | null`)
    }
    return
  }
  if ("path" in child) {
    if (typeof child.path !== "string" || child.path.length === 0) {
      errors.push(`${pathLabel(path)}: { path } must be a non-empty string`)
      return
    }
    validatePathRoot(child.path, errors, path)
    return
  }
  walkValidate(child as InputMapper, errors, path)
}

function validatePathRoot(path: string, errors: string[], errorPath: string[]): void {
  // Match the predicate path roots exactly so the two DSLs stay aligned.
  const firstSegment = path.split(".")[0] ?? ""
  const root = firstSegment.split("[")[0] ?? ""
  if (root !== "data" && root !== "metadata" && root !== "name" && root !== "emittedAt") {
    errors.push(
      `${pathLabel(errorPath)}: path root "${root}" is not one of data | metadata | name | emittedAt`,
    )
  }
}

function pathLabel(path: string[]): string {
  return path.length === 0 ? "(root)" : path.join(".")
}
