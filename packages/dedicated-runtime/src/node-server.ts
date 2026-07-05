import { type ServerType, serve } from "@hono/node-server"

import { originTrustMiddleware } from "./trust.js"
import type { ExecutionContextLike, FetchHandler, ScheduledHandler } from "./types.js"
import { createWaitUntilRegistry, type WaitUntilRegistry } from "./wait-until.js"

/** Path that health probes hit — always exempt from the origin-trust gate. */
export const HEALTHZ_PATH = "/healthz"
/** Trust-protected HTTP hook Cloud Scheduler POSTs to trigger `scheduled()`. */
export const SCHEDULED_PATH = "/__voyant/scheduled"

export interface ScheduledHandlerArgs<Env> {
  request: Request
  scheduled: ScheduledHandler<Env>
  env: Env
  ctx: ExecutionContextLike
}

/**
 * Invoke a Worker-style `scheduled()` handler from an HTTP request. Reads the
 * cron expression from the `cron` query param. Returns `202` on success, `500`
 * on handler error, `400` when `cron` is missing. Exported standalone so it can
 * be mounted into any server loop, not just {@link createNodeServer}.
 */
export async function scheduledHandler<Env>(args: ScheduledHandlerArgs<Env>): Promise<Response> {
  const cron = new URL(args.request.url).searchParams.get("cron")
  if (!cron) {
    return new Response("Missing `cron` query param", { status: 400 })
  }
  try {
    await args.scheduled({ cron, scheduledTime: Date.now() }, args.env, args.ctx)
    return new Response(null, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(`scheduled handler failed: ${message}`, { status: 500 })
  }
}

export interface CreateNodeServerOptions<Env> {
  /** The app's Worker-style fetch entrypoint — identical to the Workers build. */
  fetch: FetchHandler<Env>
  /** Optional Worker-style scheduled handler, exposed at {@link SCHEDULED_PATH}. */
  scheduled?: ScheduledHandler<Env>
  /** The composed env bag (see `buildDedicatedEnv`). */
  env: Env
  /** Listen port. Defaults to `PORT` env or `8080`. */
  port?: number
  /**
   * Per-app shared secret for the `x-voyant-origin-trust` header. When set,
   * every request except {@link HEALTHZ_PATH} must present a matching header or
   * receives `403`. Leave unset only for a fully private network boundary.
   */
  originTrustSecret?: string
  /** Milliseconds to wait for in-flight `waitUntil` work on shutdown. Default 10s. */
  drainTimeoutMs?: number
}

export interface NodeServerHandle {
  server: ServerType
  /** The `waitUntil` registry backing per-request execution contexts. */
  registry: WaitUntilRegistry
  /** Resolved listen port. */
  port: number
  /** Stop accepting, drain background work, close. Idempotent. */
  close(): Promise<void>
}

/**
 * Boot a Node HTTP server that runs an operator app's `fetch(request, env, ctx)`
 * unchanged. Adds the pieces Cloudflare provides implicitly: a real per-request
 * `waitUntil` context, an origin-trust gate, an HTTP `scheduled()` hook for
 * Cloud Scheduler, and graceful SIGTERM/SIGINT shutdown that drains in-flight
 * background work before exit.
 */
export function createNodeServer<Env>(options: CreateNodeServerOptions<Env>): NodeServerHandle {
  const port = options.port ?? Number.parseInt(process.env.PORT ?? "8080", 10)
  const registry = createWaitUntilRegistry()
  const trustGate = options.originTrustSecret
    ? originTrustMiddleware(options.originTrustSecret, { exemptPaths: [HEALTHZ_PATH] })
    : undefined

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === HEALTHZ_PATH) {
      return new Response("ok", { status: 200 })
    }

    if (trustGate) {
      const rejection = trustGate(request)
      if (rejection) return rejection
    }

    const ctx = registry.context()

    if (options.scheduled && request.method === "POST" && url.pathname === SCHEDULED_PATH) {
      return scheduledHandler({ request, scheduled: options.scheduled, env: options.env, ctx })
    }

    return options.fetch(request, options.env, ctx)
  }

  const server = serve({ fetch: handler, port })

  let closing: Promise<void> | undefined
  const close = (): Promise<void> => {
    closing ??= (async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
      await registry.drain(options.drainTimeoutMs)
    })()
    return closing
  }

  const onSignal = () => {
    void close().then(
      () => process.exit(0),
      () => process.exit(1),
    )
  }
  process.once("SIGTERM", onSignal)
  process.once("SIGINT", onSignal)

  return { server, registry, port, close }
}
