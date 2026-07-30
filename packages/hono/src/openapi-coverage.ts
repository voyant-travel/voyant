/**
 * Compare the routes a composed app actually serves against the OpenAPI
 * document committed for it.
 *
 * The committed artifacts are the published contract, but nothing ties them to
 * the runtime, so a new route, a removed route, or a renamed request field can
 * all land without the document noticing. Re-exported from `./openapi.js` so
 * consumers keep one import path.
 */
import type { OpenApiDocument } from "./openapi.js"

/**
 * One operation, as `"POST /v1/public/finance/bookings"`.
 */
export type OperationKey = string

export interface OpenApiCoverageDiff {
  /** Live routes the committed document does not describe. */
  undocumented: OperationKey[]
  /** Documented operations no longer served by the runtime. */
  stale: OperationKey[]
  /** Operations whose documented request fields drifted from the live schema. */
  requestDrift: Array<{
    operation: OperationKey
    onlyInRuntime: string[]
    onlyInDocument: string[]
  }>
}

/**
 * Compare a document generated from the live router against the committed one.
 *
 * The committed OpenAPI artifacts are the published contract, but nothing ties
 * them to the routes actually served — so a new route, a removed route, or a
 * renamed request field can all land without the document noticing. This
 * compares the two and names the difference.
 *
 * Request bodies are compared by property and required-field names rather than
 * by full schema. Generated and hand-authored schemas describe the same
 * contract in different but equivalent shapes (`nullable` versus `anyOf`, for
 * instance), so a structural diff would report noise; a field-name diff catches
 * the drift that actually breaks a client.
 */
export function diffOpenApiCoverage(input: {
  /** Document generated from the composed router, with relative paths. */
  runtime: OpenApiDocument
  /** The committed artifact, with absolute published paths. */
  committed: OpenApiDocument
  /** Absolute mount the runtime paths hang from, e.g. `/v1/public/finance`. */
  prefix: string
  /** Operations intentionally absent from the document. */
  ignore?: readonly OperationKey[]
}): OpenApiCoverageDiff {
  const ignore = new Set(input.ignore ?? [])
  const runtime = collectOperations(input.runtime, input.prefix)
  const committed = collectOperations(input.committed, "")

  const undocumented = [...runtime.keys()]
    .filter((key) => !committed.has(key) && !ignore.has(key))
    .sort()
  const stale = [...committed.keys()].filter((key) => !runtime.has(key) && !ignore.has(key)).sort()

  const requestDrift: OpenApiCoverageDiff["requestDrift"] = []
  for (const [key, liveOperation] of runtime) {
    const documented = committed.get(key)
    if (!documented || ignore.has(key)) continue
    const live = requestFieldNames(liveOperation)
    const spec = requestFieldNames(documented)
    const onlyInRuntime = [...live].filter((field) => !spec.has(field)).sort()
    const onlyInDocument = [...spec].filter((field) => !live.has(field)).sort()
    if (onlyInRuntime.length > 0 || onlyInDocument.length > 0) {
      requestDrift.push({ operation: key, onlyInRuntime, onlyInDocument })
    }
  }

  return { undocumented, stale, requestDrift }
}

const COVERAGE_METHODS = new Set(["get", "put", "post", "delete", "patch", "head", "options"])

function collectOperations(
  doc: OpenApiDocument,
  prefix: string,
): Map<OperationKey, Record<string, unknown>> {
  const operations = new Map<OperationKey, Record<string, unknown>>()
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!COVERAGE_METHODS.has(method)) continue
      if (!operation || typeof operation !== "object") continue
      operations.set(
        `${method.toUpperCase()} ${prefix}${path}`,
        operation as Record<string, unknown>,
      )
    }
  }
  return operations
}

/** Request body property names plus `required:<name>` markers. */
function requestFieldNames(operation: Record<string, unknown>): Set<string> {
  const names = new Set<string>()
  const body = operation.requestBody
  if (!body || typeof body !== "object") return names
  const content = (body as { content?: Record<string, { schema?: unknown }> }).content
  const schema = content?.["application/json"]?.schema
  if (!schema || typeof schema !== "object") return names
  const properties = (schema as { properties?: Record<string, unknown> }).properties
  for (const name of Object.keys(properties ?? {})) names.add(name)
  const required = (schema as { required?: unknown }).required
  if (Array.isArray(required)) {
    for (const name of required) if (typeof name === "string") names.add(`required:${name}`)
  }
  return names
}
