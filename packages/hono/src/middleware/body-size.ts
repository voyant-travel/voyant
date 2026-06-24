import type { Context, MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"

export interface RequestBodyLimitOptions {
  maxBytes: number
}

export const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 10 * 1024 * 1024

export function requestBodyLimit(options: RequestBodyLimitOptions): MiddlewareHandler {
  // Hono's bodyLimit checks the Content-Length header AND wraps the request body
  // stream so it throws once the actual read exceeds maxSize. That stream cap is
  // what bounds chunked / HTTP/2 requests with no Content-Length header — the
  // case the previous header-only check could not catch (e.g. `.openapi()` json
  // routes that read via c.req.json() and never went through parseJsonBody).
  const enforce = bodyLimit({
    maxSize: options.maxBytes,
    onError: (c) => tooLargeResponse(c, options.maxBytes),
  })

  return async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
      return next()
    }

    return enforce(c, next)
  }
}

function tooLargeResponse(c: Context, maxBytes: number): Response {
  return c.json(
    {
      error: "Request body too large",
      code: "request_body_too_large",
      maxBytes,
    },
    413,
  )
}
