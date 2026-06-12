import type { MiddlewareHandler } from "hono"

import type { LoggerProvider } from "../types.js"

export const consoleLoggerProvider: LoggerProvider = {
  log(entry) {
    console.log(`${entry.method} ${entry.path} → ${entry.status} (${entry.durationMs}ms)`)
  },
}

function logPath(c: Parameters<MiddlewareHandler>[0]): string {
  const routePath = c.req.routePath
  if (routePath && routePath !== "/*") return routePath
  return c.req.path
    .replace(/(\/accountant\/)[^/]+/g, "$1[token]")
    .replace(/(\/download\/)[^/]+/g, "$1[token]")
}

export function logger(provider?: LoggerProvider): MiddlewareHandler {
  const log = provider ?? consoleLoggerProvider
  return async (c, next) => {
    const start = Date.now()
    await next()
    const durationMs = Date.now() - start
    log.log({
      method: c.req.method,
      path: logPath(c),
      status: c.res.status,
      durationMs,
    })
  }
}
