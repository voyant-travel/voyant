import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { ZodError, type ZodType } from "zod"

import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "./middleware/body-size.js"

export class ApiHttpError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      status: number
      code?: string
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = "ApiHttpError"
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

export class RequestValidationError extends ApiHttpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      status: 400,
      code: "invalid_request",
      details,
    })
    this.name = "RequestValidationError"
  }
}

export class UnauthorizedApiError extends ApiHttpError {
  constructor(message = "Unauthorized") {
    super(message, {
      status: 401,
      code: "unauthorized",
    })
    this.name = "UnauthorizedApiError"
  }
}

export class ForbiddenApiError extends ApiHttpError {
  constructor(message = "Forbidden") {
    super(message, {
      status: 403,
      code: "forbidden",
    })
    this.name = "ForbiddenApiError"
  }
}

function toValidationError(
  error: ZodError,
  fallbackMessage = "Invalid request",
): RequestValidationError {
  return new RequestValidationError(error.issues[0]?.message ?? fallbackMessage, {
    issues: error.issues,
    fields: error.flatten(),
  })
}

function validate<T>(schema: ZodType<T>, input: unknown, fallbackMessage?: string): T {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw toValidationError(parsed.error, fallbackMessage)
  }

  return parsed.data
}

export async function parseJsonBody<T>(
  c: Context,
  schema: ZodType<T>,
  options?: { invalidJsonMessage?: string; invalidBodyMessage?: string; maxBytes?: number },
): Promise<T> {
  let input: unknown

  const text = await readBoundedRequestText(c, options?.maxBytes)
  try {
    input = JSON.parse(text)
  } catch {
    throw new RequestValidationError(options?.invalidJsonMessage ?? "Invalid JSON body")
  }

  return validate(schema, input, options?.invalidBodyMessage)
}

export async function parseOptionalJsonBody<T>(
  c: Context,
  schema: ZodType<T>,
  options?: {
    defaultValue?: unknown
    invalidBodyMessage?: string
    maxBytes?: number
  },
): Promise<T> {
  let input: unknown

  const text = await readBoundedRequestText(c, options?.maxBytes)
  if (text.length === 0) {
    return validate(schema, options?.defaultValue ?? {}, options?.invalidBodyMessage)
  }
  try {
    input = JSON.parse(text)
  } catch {
    input = options?.defaultValue ?? {}
  }

  return validate(schema, input, options?.invalidBodyMessage)
}

async function readBoundedRequestText(c: Context, maxBytes = DEFAULT_REQUEST_BODY_LIMIT_BYTES) {
  const contentLength = c.req.header("content-length")
  if (contentLength) {
    const size = Number(contentLength)
    if (Number.isFinite(size) && size > maxBytes) {
      throw new RequestValidationError("Request body too large", { maxBytes })
    }
  }

  const text = await c.req.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestValidationError("Request body too large", { maxBytes })
  }
  return text
}

export function parseQuery<T>(
  c: Context,
  schema: ZodType<T>,
  options?: { invalidQueryMessage?: string },
): T {
  return validate(
    schema,
    Object.fromEntries(new URL(c.req.url).searchParams),
    options?.invalidQueryMessage ?? "Invalid query parameters",
  )
}

export function normalizeValidationError(error: unknown): ApiHttpError | undefined {
  if (error instanceof ApiHttpError) {
    return error
  }

  if (error instanceof ZodError) {
    return toValidationError(error)
  }

  if (error instanceof HTTPException) {
    // Hono's request validators throw HTTPException before our validation hook
    // runs — most notably HTTPException(400, "Malformed JSON in request body")
    // from the JSON body parser on `.openapi()` routes. Map it onto the
    // framework error contract so bad client input is a structured 4xx, not a
    // 500 (voyant#2114).
    return new ApiHttpError(error.message, {
      status: error.status,
      code: error.status === 400 ? "invalid_request" : undefined,
    })
  }

  return undefined
}
