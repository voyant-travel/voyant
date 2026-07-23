import { z } from "zod"

const COMBINATORS = new Set(["allOf", "anyOf", "oneOf"])

export function generateWebhookTestPayload(
  schema: Readonly<Record<string, unknown>>,
  now: Date,
): unknown {
  const candidate = sampleValue(schema, now)
  if (!validates(schema, candidate)) {
    throw new Error("The webhook event schema cannot produce a valid test payload.")
  }
  return candidate
}

function sampleValue(schema: Readonly<Record<string, unknown>>, now: Date): unknown {
  const declaredCandidates = [
    "const" in schema ? schema.const : undefined,
    schema.example,
    schema.default,
    ...(Array.isArray(schema.examples) ? schema.examples : []),
    ...(Array.isArray(schema.enum) ? schema.enum : []),
  ].filter((value) => value !== undefined)
  const declared = declaredCandidates.find((value) => validates(schema, value))
  if (declared !== undefined) return declared

  for (const combinator of ["oneOf", "anyOf"] as const) {
    if (!Array.isArray(schema[combinator])) continue
    const base = sampleBase(schema, now)
    for (const branch of schema[combinator]) {
      if (!isRecord(branch)) continue
      try {
        const candidate = mergeSamples(base, sampleValue(branch, now))
        if (validates(schema, candidate)) return candidate
      } catch {
        // Continue until a branch can produce a value accepted by the whole combinator.
      }
    }
    throw new Error(`The webhook event schema has no sampleable ${combinator} branch.`)
  }

  if (Array.isArray(schema.allOf)) {
    let candidate = sampleBase(schema, now)
    for (const branch of schema.allOf) {
      if (!isRecord(branch)) continue
      candidate = mergeSamples(candidate, sampleValue(branch, now))
    }
    if (validates(schema, candidate)) return candidate
    throw new Error("The webhook event schema has no sampleable allOf value.")
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  for (const type of types) {
    const candidate = sampleType(type, schema, now)
    if (candidate.found && validates(schema, candidate.value)) return candidate.value
  }
  throw new Error("The webhook event schema uses unsupported or unsatisfiable constraints.")
}

function sampleType(
  type: unknown,
  schema: Readonly<Record<string, unknown>>,
  now: Date,
): { found: true; value: unknown } | { found: false } {
  if (type === "object") return { found: true, value: sampleObject(schema, now) }
  if (type === "array") return { found: true, value: sampleArray(schema, now) }
  if (type === "string") return { found: true, value: sampleString(schema, now) }
  if (type === "integer") return { found: true, value: sampleNumber(schema, true) }
  if (type === "number") return { found: true, value: sampleNumber(schema, false) }
  if (type === "boolean") return { found: true, value: false }
  if (type === "null") return { found: true, value: null }
  return { found: false }
}

function sampleObject(
  schema: Readonly<Record<string, unknown>>,
  now: Date,
): Record<string, unknown> {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [],
  )
  const minimum = nonNegativeInteger(schema.minProperties)
  const selected = new Set(required)
  for (const name of Object.keys(properties)) {
    if (selected.size >= minimum) break
    selected.add(name)
  }
  return Object.fromEntries(
    [...selected].map((name) => {
      const propertySchema = properties[name]
      if (!isRecord(propertySchema)) {
        throw new Error(`Required webhook test property "${name}" has no usable schema.`)
      }
      return [name, sampleValue(propertySchema, now)]
    }),
  )
}

function sampleArray(schema: Readonly<Record<string, unknown>>, now: Date): unknown[] {
  const minimum = nonNegativeInteger(schema.minItems)
  if (minimum === 0) return []
  if (!isRecord(schema.items)) {
    throw new Error("Webhook test arrays with minItems require an item schema.")
  }
  return Array.from({ length: minimum }, () =>
    sampleValue(schema.items as Record<string, unknown>, now),
  )
}

function sampleString(schema: Readonly<Record<string, unknown>>, now: Date): string {
  const minimum = nonNegativeInteger(schema.minLength)
  const maximum =
    typeof schema.maxLength === "number" && Number.isInteger(schema.maxLength)
      ? schema.maxLength
      : Number.POSITIVE_INFINITY
  let value =
    schema.format === "date-time"
      ? now.toISOString()
      : schema.format === "date"
        ? now.toISOString().slice(0, 10)
        : schema.format === "email"
          ? "webhook-test@example.com"
          : "test"
  if (value.length < minimum) value = value.padEnd(minimum, "x")
  if (value.length > maximum) value = value.slice(0, maximum)
  return value
}

function sampleNumber(schema: Readonly<Record<string, unknown>>, integer: boolean): number {
  const minimum =
    typeof schema.minimum === "number"
      ? schema.minimum
      : typeof schema.exclusiveMinimum === "number"
        ? schema.exclusiveMinimum + (integer ? 1 : Number.EPSILON)
        : 0
  const multiple =
    typeof schema.multipleOf === "number" && schema.multipleOf > 0 ? schema.multipleOf : 1
  let value = Math.ceil(minimum / multiple) * multiple
  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
    value += multiple
  }
  if (integer) value = Math.ceil(value)
  return value
}

function validates(schema: Readonly<Record<string, unknown>>, value: unknown): boolean {
  try {
    const input = schema as Parameters<typeof z.fromJSONSchema>[0]
    return z.fromJSONSchema(input).safeParse(value).success
  } catch {
    return false
  }
}

function withoutCombinators(
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !COMBINATORS.has(key)))
}

function sampleBase(schema: Readonly<Record<string, unknown>>, now: Date): unknown {
  const base = withoutCombinators(schema)
  return Object.keys(base).length === 0 ? undefined : sampleValue(base, now)
}

function mergeSamples(base: unknown, branch: unknown): unknown {
  return isRecord(base) && isRecord(branch) ? { ...base, ...branch } : branch
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
