export interface StorefrontBookErrorBody {
  error?: unknown
  code?: unknown
  requestId?: unknown
  details?: unknown
  context?: { upstreamPayload?: { reason?: unknown } }
}

const SPACE = String.fromCharCode(32)
const PERIOD = String.fromCharCode(46)
const SENTENCE_SEPARATOR = PERIOD + SPACE

export function buildStorefrontBookFailureMessage(
  body: StorefrontBookErrorBody,
  requestId: string | null,
  fallback: string,
  requestReferenceTemplate: string,
): string {
  const message = firstString(body.error) ?? firstFieldError(body.details)
  const reference = firstString(body.requestId) ?? requestId
  const withMessage = message ? appendSentence(fallback, message) : fallback
  return reference
    ? appendSentence(withMessage, requestReferenceTemplate.replace("{requestId}", reference))
    : withMessage
}

function appendSentence(base: string, sentence: string): string {
  const trimmedBase = base.trim()
  const trimmedSentence = sentence.trim()
  if (!trimmedSentence) return trimmedBase
  const separator = /[.!?]$/.test(trimmedBase) ? SPACE : SENTENCE_SEPARATOR
  const suffix = /[.!?]$/.test(trimmedSentence) ? trimmedSentence : trimmedSentence + PERIOD
  return `${trimmedBase}${separator}${suffix}`
}

function firstFieldError(details: unknown): string | null {
  const record = asObject(details)
  const fields = asObject(record?.fields) ?? record
  const fieldErrors = asObject(fields?.fieldErrors)
  if (!fieldErrors) return null

  for (const value of Object.values(fieldErrors)) {
    const message = firstString(value)
    if (message) return message
  }
  return null
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstString(item)
      if (message) return message
    }
  }
  return null
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
