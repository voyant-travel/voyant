import type { MiddlewareHandler } from "hono"

export interface RequestBodyLimitOptions {
  maxBytes: number
}

export const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 10 * 1024 * 1024

export function requestBodyLimit(options: RequestBodyLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
      return next()
    }

    const contentLength = c.req.header("content-length")
    if (contentLength) {
      const size = Number(contentLength)
      if (Number.isFinite(size) && size > options.maxBytes) {
        return c.json(
          {
            error: "Request body too large",
            code: "request_body_too_large",
            maxBytes: options.maxBytes,
          },
          413,
        )
      }
    }

    return next()
  }
}
