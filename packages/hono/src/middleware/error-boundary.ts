import { apiErrorSchema } from "@voyantjs/types"
import type { Context, MiddlewareHandler } from "hono"

import { normalizeValidationError } from "../validation.js"

function generateRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export const requestId: MiddlewareHandler = async (c, next) => {
  const existing = c.req.header("x-request-id")
  const id = existing?.trim() || generateRequestId()
  c.res.headers.set("X-Request-Id", id)
  await next()
}

const REDACT_HEADERS = new Set(["authorization", "x-api-key"])

export function handleApiError(err: unknown, c: Context): Response {
  const id = c.res.headers.get("X-Request-Id") || generateRequestId()
  const apiError = normalizeValidationError(err)
  const errRecord = err instanceof Object ? (err as Record<string, unknown>) : {}
  const code = apiError?.code ?? (typeof errRecord.code === "string" ? errRecord.code : undefined)
  const status = apiError?.status ?? (typeof errRecord.status === "number" ? errRecord.status : 500)
  const details =
    apiError?.details ??
    (status < 500 && errRecord.details && typeof errRecord.details === "object"
      ? (errRecord.details as Record<string, unknown>)
      : undefined)
  const errorMessage =
    status < 500
      ? (apiError?.message ??
        (typeof errRecord.message === "string" ? errRecord.message : "Bad Request"))
      : "Internal Server Error"

  try {
    const headers: Record<string, string> = {}
    c.req.raw.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      headers[lowerKey] = REDACT_HEADERS.has(lowerKey) ? "[redacted]" : value
    })

    console.error("[API:error]", {
      id,
      status,
      code,
      path: c.req.path,
      method: c.req.method,
      headers,
      err: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error && err.cause ? String(err.cause) : undefined,
      stack: err instanceof Error ? err.stack : undefined,
    })
  } catch {
    /* ignore logging errors */
  }

  const statusCode = status >= 100 && status <= 599 ? status : 500
  return new Response(
    JSON.stringify(apiErrorSchema.parse({ error: errorMessage, code, requestId: id, details })),
    {
      status: statusCode,
      headers: {
        "content-type": "application/json",
      },
    },
  )
}

export const errorBoundary: MiddlewareHandler = async (c, next) => {
  try {
    await next()
  } catch (err: unknown) {
    return handleApiError(err, c)
  }
}
