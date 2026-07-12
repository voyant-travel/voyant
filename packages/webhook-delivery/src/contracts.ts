import type { EventEnvelope } from "@voyant-travel/core"

const REDACTION_MARKER = "[REDACTED]"

export interface ExternalWebhookEventContract {
  eventId: string
  eventType: string
  eventVersion: string
  payloadSchema: Readonly<Record<string, unknown>>
}

export interface WebhookSubscriptionEventInput {
  events?: readonly string[]
}

export function assertWebhookSubscriptionCreateEvents(
  input: WebhookSubscriptionEventInput,
  contracts: readonly ExternalWebhookEventContract[],
): void {
  assertSelectedExternalEvents(input.events, contracts, "create")
}

export function assertWebhookSubscriptionUpdateEvents(
  input: WebhookSubscriptionEventInput,
  contracts: readonly ExternalWebhookEventContract[],
): void {
  if (input.events === undefined) return
  assertSelectedExternalEvents(input.events, contracts, "update")
}

export function prepareExternalWebhookEvent(
  event: EventEnvelope,
  contract: ExternalWebhookEventContract,
): EventEnvelope {
  if (event.name !== contract.eventType) {
    throw new Error(
      `External webhook contract "${contract.eventId}" governs "${contract.eventType}", not "${event.name}".`,
    )
  }

  const metadata = event.metadata ?? {}
  assertMetadata(metadata, "graphEventId", contract.eventId)
  assertMetadata(metadata, "graphEventVersion", contract.eventVersion)

  return {
    name: event.name,
    data: projectValue(event.data, contract.payloadSchema, "$.data"),
    emittedAt: event.emittedAt,
    metadata: externalMetadata(metadata, contract),
  }
}

function assertSelectedExternalEvents(
  events: readonly string[] | undefined,
  contracts: readonly ExternalWebhookEventContract[],
  operation: "create" | "update",
): void {
  if (!events || events.length === 0) {
    throw new Error(`Webhook subscription ${operation} requires at least one event.`)
  }
  const selected = new Set(contracts.map(({ eventType }) => eventType))
  const unknown = [...new Set(events.filter((eventType) => !selected.has(eventType)))].sort()
  if (unknown.length > 0) {
    throw new Error(
      `Webhook subscription ${operation} requested events outside the selected external catalog: ${unknown.join(", ")}.`,
    )
  }
}

function projectValue(
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
  path: string,
): unknown {
  if (schema.writeOnly === true || schema["x-voyant-redact"] === true) return REDACTION_MARKER
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throw new Error(`External webhook payload ${path} is not an allowed enum value.`)
  }

  const type = schema.type
  if (type === "object") return projectObject(value, schema, path)
  if (type === "array") return projectArray(value, schema, path)
  if (type === "string" && typeof value !== "string") return invalidType(path, "string")
  if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    return invalidType(path, "number")
  }
  if (type === "integer" && (typeof value !== "number" || !Number.isInteger(value))) {
    return invalidType(path, "integer")
  }
  if (type === "boolean" && typeof value !== "boolean") return invalidType(path, "boolean")
  if (type === "null" && value !== null) return invalidType(path, "null")
  return value
}

function projectObject(
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
  path: string,
): Record<string, unknown> {
  if (!isRecord(value)) return invalidType(path, "object")
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [],
  )
  const output: Record<string, unknown> = {}

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!isRecord(propertySchema)) continue
    if (!(key in value)) {
      if (required.has(key)) throw new Error(`External webhook payload ${path}.${key} is required.`)
      continue
    }
    output[key] = projectValue(value[key], propertySchema, `${path}.${key}`)
  }

  return output
}

function projectArray(
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
  path: string,
): unknown[] {
  if (!Array.isArray(value)) return invalidType(path, "array")
  if (!isRecord(schema.items)) return []
  return value.map((entry, index) =>
    projectValue(entry, schema.items as Record<string, unknown>, `${path}[${index}]`),
  )
}

function externalMetadata(
  metadata: Readonly<Record<string, unknown>>,
  contract: ExternalWebhookEventContract,
): Record<string, unknown> {
  return {
    ...(typeof metadata.eventId === "string" ? { eventId: metadata.eventId } : {}),
    ...(typeof metadata.correlationId === "string"
      ? { correlationId: metadata.correlationId }
      : {}),
    ...(typeof metadata.causationId === "string" ? { causationId: metadata.causationId } : {}),
    graphEventId: contract.eventId,
    graphEventVersion: contract.eventVersion,
  }
}

function assertMetadata(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
  expected: string,
): void {
  const actual = metadata[key]
  if (actual !== undefined && actual !== expected) {
    throw new Error(
      `External webhook metadata ${key} does not match selected contract "${expected}".`,
    )
  }
}

function invalidType(path: string, expected: string): never {
  throw new Error(`External webhook payload ${path} must be ${expected}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
