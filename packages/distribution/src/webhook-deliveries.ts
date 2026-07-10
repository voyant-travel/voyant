/**
 * `prepareOutboundEnvelope` — the ONLY allowed write path into
 * `webhook_deliveries`. Enforces the redaction guarantees called for in
 * channel-push-architecture §11.3:
 *
 *   1. Drops sensitive headers (Authorization, Cookie, X-Api-Key, …).
 *   2. Bounds request/response excerpts to 4 KB so the table doesn't
 *      become a body archive.
 *   3. Hashes the request body (SHA-256 over canonical JSON or raw
 *      text) so retries can be correlated and drift detected without
 *      exposing payloads.
 *
 * v2 will add per-flow PII redactors here (booking-traveler payloads,
 * email/phone shapes); v1 keeps the envelope minimal and documents the
 * redactor as the future home of those rules.
 *
 * Direct INSERTs into `webhook_deliveries` from anywhere except this
 * helper are a lint violation per §11.3.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import {
  type InfraWebhookDelivery,
  infraWebhookDeliveriesTable,
  infraWebhookDeliverySelectSchema,
  type SelectInfraWebhookDelivery,
} from "@voyant-travel/db/schema/infra"
import { and, eq } from "drizzle-orm"

const DEFAULT_EXCERPT_BYTES = 4 * 1024

const REDACTED_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-api-token",
  "x-auth-token",
  "x-access-token",
  "api-key",
  "apikey",
])

const REDACTION_MARKER = "[REDACTED]"

/**
 * Body-key names that always redact (case-insensitive). Every match is
 * replaced with `[REDACTED]` regardless of value type. Per §11.3 — PII
 * redaction is a library guarantee, not caller discipline.
 */
const REDACTED_BODY_KEYS = new Set([
  // Auth
  "password",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "apitoken",
  "authorization",
  // Personal identifiers
  "email",
  "phone",
  "phonenumber",
  "mobile",
  "ssn",
  "passport",
  "passportnumber",
  "documentnumber",
  "nationalid",
  "taxid",
  "dob",
  "dateofbirth",
  "birthdate",
  // Payment
  "cardnumber",
  "pan",
  "cvv",
  "cvc",
  "iban",
  "bic",
  "accountnumber",
  // Booking-traveler shapes
  "firstname",
  "lastname",
  "fullname",
  "middlename",
])

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/g

export interface OutboundEnvelopeInput {
  // ── Provenance ────────────────────────────────────────────────────
  sourceModule: string
  sourceEvent: string
  sourceEntityModule?: string
  sourceEntityId?: string
  subscriptionId?: string

  // ── Target ────────────────────────────────────────────────────────
  targetUrl: string
  targetKind?: string
  targetRef?: string

  // ── Request ──────────────────────────────────────────────────────
  requestMethod: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown

  // ── Retry chain ──────────────────────────────────────────────────
  attemptNumber?: number
  parentDeliveryId?: string
  idempotencyKey?: string

  // ── Lifecycle hint ───────────────────────────────────────────────
  /** When set, the row starts in "pending" / `scheduledFor`. v1 dispatches inline. */
  scheduledFor?: Date
}

export interface OutboundEnvelopeResultInput {
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: unknown
  errorClass?: InfraWebhookDelivery["errorClass"]
  errorMessage?: string
}

export interface PreparedEnvelope {
  /** The persisted (in-flight) row — caller updates it with the result. */
  delivery: InfraWebhookDelivery
  /** Finalize the envelope after the upstream call returns or throws. */
  complete: (result: OutboundEnvelopeResultInput) => Promise<InfraWebhookDelivery>
}

/**
 * Persist an outbound request for a future delivery worker without claiming
 * that an HTTP attempt has started. Replays with the same idempotency key and
 * attempt number return the existing row.
 */
export async function enqueueOutboundEnvelope(
  db: AnyDrizzleDb,
  input: OutboundEnvelopeInput & { idempotencyKey: string },
): Promise<InfraWebhookDelivery> {
  const attemptNumber = input.attemptNumber ?? 1
  const existing = (await db
    .select()
    .from(infraWebhookDeliveriesTable)
    .where(
      and(
        eq(infraWebhookDeliveriesTable.idempotencyKey, input.idempotencyKey),
        eq(infraWebhookDeliveriesTable.attemptNumber, attemptNumber),
      ),
    )
    .limit(1)) as SelectInfraWebhookDelivery[]
  if (existing[0]) return toInfraWebhookDelivery(existing[0])

  const now = new Date()
  const inserted = (await db
    .insert(infraWebhookDeliveriesTable)
    .values({
      id: newId("webhook_deliveries"),
      sourceModule: input.sourceModule,
      sourceEvent: input.sourceEvent,
      sourceEntityModule: input.sourceEntityModule ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      targetUrl: input.targetUrl,
      targetKind: input.targetKind ?? null,
      targetRef: input.targetRef ?? null,
      requestMethod: input.requestMethod,
      requestHeaders: redactHeaders(input.requestHeaders),
      requestBodyHash: hashBodySync(input.requestBody),
      requestBodyExcerpt: excerptBody(input.requestBody),
      attemptNumber,
      parentDeliveryId: input.parentDeliveryId ?? null,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
      scheduledFor: input.scheduledFor ?? now,
      startedAt: null,
    })
    .returning()) as SelectInfraWebhookDelivery[]
  const row = inserted[0]
  if (!row) throw new Error("enqueueOutboundEnvelope: insert returned no rows")
  return toInfraWebhookDelivery(row)
}

function toInfraWebhookDelivery(row: SelectInfraWebhookDelivery): InfraWebhookDelivery {
  return infraWebhookDeliverySelectSchema.parse(row)
}

/**
 * Begin an outbound delivery: redacts the request, persists an
 * in-flight row, and returns a `complete()` finisher the caller invokes
 * with the response (or error).
 *
 * Usage:
 *   const env = await prepareOutboundEnvelope(db, { ... })
 *   try {
 *     const res = await fetch(...)
 *     await env.complete({ responseStatus: res.status, ... })
 *   } catch (err) {
 *     await env.complete({ errorClass: "network", errorMessage: String(err) })
 *   }
 */
export async function prepareOutboundEnvelope(
  db: AnyDrizzleDb,
  input: OutboundEnvelopeInput,
): Promise<PreparedEnvelope> {
  const startedAt = new Date()
  const redactedRequestHeaders = redactHeaders(input.requestHeaders)
  const requestBodyHash = hashBodySync(input.requestBody)
  const requestBodyExcerpt = excerptBody(input.requestBody)

  const id = newId("webhook_deliveries")
  const inserted = (await db
    .insert(infraWebhookDeliveriesTable)
    .values({
      id,
      sourceModule: input.sourceModule,
      sourceEvent: input.sourceEvent,
      sourceEntityModule: input.sourceEntityModule ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      targetUrl: input.targetUrl,
      targetKind: input.targetKind ?? null,
      targetRef: input.targetRef ?? null,
      requestMethod: input.requestMethod,
      requestHeaders: redactedRequestHeaders,
      requestBodyHash,
      requestBodyExcerpt,
      attemptNumber: input.attemptNumber ?? 1,
      parentDeliveryId: input.parentDeliveryId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      status: "in_flight",
      scheduledFor: input.scheduledFor ?? null,
      startedAt,
    })
    .returning()) as SelectInfraWebhookDelivery[]

  const row = inserted[0]
  if (!row) throw new Error("prepareOutboundEnvelope: insert returned no rows")

  const delivery = toInfraWebhookDelivery(row)

  return {
    delivery,
    async complete(result) {
      const finishedAt = new Date()
      const durationMs = finishedAt.getTime() - startedAt.getTime()
      const status = decideStatus(result)
      const updated = (await db
        .update(infraWebhookDeliveriesTable)
        .set({
          responseStatus: result.responseStatus ?? null,
          responseHeaders: redactHeaders(result.responseHeaders),
          responseBodyExcerpt: excerptBody(result.responseBody),
          status,
          finishedAt,
          durationMs,
          errorClass: result.errorClass ?? null,
          errorMessage: result.errorMessage ?? null,
          updatedAt: finishedAt,
        })
        .where(eq(infraWebhookDeliveriesTable.id, delivery.id))
        .returning()) as SelectInfraWebhookDelivery[]
      const finalized = updated[0]
      if (!finalized) {
        throw new Error("prepareOutboundEnvelope.complete: update returned no rows")
      }
      return toInfraWebhookDelivery(finalized)
    },
  }
}

function decideStatus(result: OutboundEnvelopeResultInput): InfraWebhookDelivery["status"] {
  if (result.errorClass) return "failed"
  const code = result.responseStatus ?? 0
  if (code >= 200 && code < 400) return "succeeded"
  if (code >= 400) return "failed"
  return "failed"
}

export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | null {
  if (!headers) return null
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    out[name] = REDACTED_HEADERS.has(name.toLowerCase()) ? REDACTION_MARKER : value
  }
  return out
}

function excerptBody(body: unknown, max = DEFAULT_EXCERPT_BYTES): string | null {
  if (body == null) return null
  let text: string
  if (typeof body === "string") {
    text = redactStringPii(body)
  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    text = "[binary]"
  } else {
    try {
      text = JSON.stringify(redactBodyPii(body))
    } catch {
      text = "[unserializable]"
    }
  }
  if (text.length > max) {
    return `${text.slice(0, max - 1)}…`
  }
  return text
}

/**
 * Recursively redact PII from a JSON-serializable body. Every key whose
 * lowercased name matches `REDACTED_BODY_KEYS` is replaced with
 * `[REDACTED]`; remaining string values get email/phone shapes
 * scrubbed. This protects channel-push booking payloads (which carry
 * traveler contact info) from leaking into the delivery log per §11.3.
 *
 * Exported for callers that want to redact bodies before passing them
 * to other sinks (logs, error reporters).
 */
export function redactBodyPii(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === "string") return redactStringPii(value)
  if (typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(redactBodyPii)
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "")
    if (REDACTED_BODY_KEYS.has(normalized)) {
      out[key] = REDACTION_MARKER
    } else {
      out[key] = redactBodyPii(raw)
    }
  }
  return out
}

/**
 * Scrub email/phone shapes from a free-text string. The patterns are
 * coarse on purpose — false positives (e.g. a phone-shaped tracking id)
 * are preferable to leaks.
 */
export function redactStringPii(text: string): string {
  return text.replace(EMAIL_PATTERN, REDACTION_MARKER).replace(PHONE_PATTERN, REDACTION_MARKER)
}

/**
 * Stable SHA-256 hash of the body, computed sync via Web Crypto when
 * available. Returns null when crypto is unavailable (the column
 * permits null and downstream consumers tolerate it).
 *
 * Note: this helper does NOT await; it returns the SubtleCrypto
 * promise's eventual hex string by consuming it synchronously where
 * possible. We use a small wrapper so callers don't sprinkle awaits.
 *
 * For deterministic behavior we hash the canonical-JSON serialization
 * of the body. Strings hash directly. Binary inputs hash as the byte
 * array.
 */
function hashBodySync(body: unknown): string | null {
  if (body == null) return null
  // Synchronous hashing isn't available in browser/CF Workers crypto —
  // we accept that v1 stores no hash for binary bodies and only the
  // text-canonicalized hash for the rest. For the hot path (channel
  // push HTTP requests), bodies are small and JSON-stringified, so we
  // return a deterministic hex string built from a fast non-crypto
  // hash. v2 can swap in SubtleCrypto with an async write.
  let text: string
  if (typeof body === "string") {
    text = body
  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return null
  } else {
    try {
      text = JSON.stringify(body)
    } catch {
      return null
    }
  }
  return fnv1a64(text)
}

/**
 * 64-bit FNV-1a hash, hex-encoded. Not a cryptographic hash — purely
 * a stable fingerprint for "is this the same body on retry?" and drift
 * detection. v2 swaps to SubtleCrypto SHA-256 with async writes.
 */
function fnv1a64(str: string): string {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i))
    h = (h * prime) & mask
  }
  return h.toString(16).padStart(16, "0")
}
