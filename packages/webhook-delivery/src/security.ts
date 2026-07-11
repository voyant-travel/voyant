import { createHash, createHmac } from "node:crypto"

const DEFAULT_EXCERPT_BYTES = 4 * 1024
const REDACTION_MARKER = "[REDACTED]"
const REDACTED_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-api-token",
  "x-auth-token",
  "x-access-token",
  "x-voyant-signature",
  "api-key",
  "apikey",
])
const REDACTED_BODY_KEYS = new Set([
  "password",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "apitoken",
  "authorization",
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
  "cardnumber",
  "pan",
  "cvv",
  "cvc",
  "iban",
  "bic",
  "accountnumber",
  "firstname",
  "lastname",
  "fullname",
  "middlename",
])
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/g

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`
}

export function hashWebhookPayload(body: string): string {
  return createHash("sha256").update(body).digest("hex")
}

export function redactWebhookHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | null {
  if (!headers) return null
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      REDACTED_HEADERS.has(name.toLowerCase()) ? REDACTION_MARKER : value,
    ]),
  )
}

export function webhookBodyExcerpt(body: unknown, maxBytes = DEFAULT_EXCERPT_BYTES): string | null {
  if (body == null) return null
  let text: string
  if (typeof body === "string") {
    try {
      text = JSON.stringify(redactValue(JSON.parse(body)))
    } catch {
      text = redactString(body)
    }
  } else {
    try {
      text = JSON.stringify(redactValue(body))
    } catch {
      text = "[unserializable]"
    }
  }
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text
  return `${Buffer.from(text, "utf8")
    .subarray(0, Math.max(0, maxBytes - 3))
    .toString("utf8")}...`
}

function redactValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === "string") return redactString(value)
  if (typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(redactValue)
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "")
    output[key] = REDACTED_BODY_KEYS.has(normalized) ? REDACTION_MARKER : redactValue(item)
  }
  return output
}

function redactString(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTION_MARKER).replace(PHONE_PATTERN, REDACTION_MARKER)
}
