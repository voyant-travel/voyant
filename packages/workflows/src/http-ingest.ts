// Optional HTTP ingest adapter — mounts `/api/manifests` and `/api/events`
// on a Hono-shaped app, forwarding into a `WorkflowDriver`.
//
// Self-host Node deployments mount this when external emitters need to
// fire events into the runtime (storefront BFF, third-party webhooks,
// sibling-process pairs across machines). Managed Cloud mounts its own
// HTTP boundary in the cloud repository.
//
// Transport-agnostic: takes a minimal `HttpAppLike` interface so the SDK
// stays a leaf package (no `hono` dep). `@voyant-travel/voyant-hono`'s `Hono`
// instance satisfies the shape via TypeScript structural compat.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md.

import type { IngestEventArgs, WorkflowDriver } from "./driver.js"
import type { EnvironmentName } from "./types.js"

const ALLOWED_ENVS = new Set<EnvironmentName>(["production", "preview", "development"])

// ---- Public types ----

/**
 * Minimum interface a Hono-shaped app exposes that we use. `app.post(...)`
 * and `app.get(...)` register handlers; the handler signature mirrors
 * Hono's `Context`-style callback for portability — we only read the
 * request body and request params via the framework's response helpers.
 */
export interface HttpAppLike {
  post(path: string, handler: HttpHandler): unknown
  get(path: string, handler: HttpHandler): unknown
}

/**
 * Minimum context shape we read off Hono. Restricted to body parsing,
 * route params, and JSON response helpers.
 */
export interface HttpContextLike {
  req: {
    json(): Promise<unknown>
    param(name: string): string | undefined
    header(name: string): string | undefined
    raw: Request
  }
  json(body: unknown, status?: number): Response
  text(body: string, status?: number): Response
  status(code: number): unknown
}

export type HttpHandler = (ctx: HttpContextLike) => Promise<Response> | Response

export interface MountHttpIngestAdapterOptions {
  /**
   * Driver the adapter forwards into. Typically the same instance
   * `createApp({ workflows: { driver } })` constructed.
   */
  driver: WorkflowDriver
  /** Mount path. Defaults to `"/api/workflows"`. */
  basePath?: string
  /**
   * Optional auth check. Receives the original `Request` and returns
   * `void` on success / throws on failure. Reuse
   * `createBearerVerifier(...)` from `@voyant-travel/workflows/auth` for the
   * canonical bearer-token shape.
   */
  verifyRequest?: (req: Request) => void | Promise<void>
}

// ---- Mount ----

/**
 * Mount the adapter onto a Hono-shaped app. Registers:
 *
 *   POST {basePath}/events                         → driver.ingestEvent
 *   POST {basePath}/manifests                      → driver.registerManifest
 *   GET  {basePath}/manifests/:env                 → driver.getManifest
 *
 * Returns the mounted base path so callers can log it.
 */
export function mountHttpIngestAdapter(
  app: HttpAppLike,
  opts: MountHttpIngestAdapterOptions,
): string {
  const base = (opts.basePath ?? "/api/workflows").replace(/\/$/, "")

  app.post(`${base}/events`, async (ctx) => {
    if (opts.verifyRequest) {
      try {
        await opts.verifyRequest(ctx.req.raw)
      } catch (err) {
        return ctx.json({ error: "unauthorized", message: errMessage(err) }, 401)
      }
    }

    let raw: unknown
    try {
      raw = await ctx.req.json()
    } catch (err) {
      return ctx.json({ error: "invalid_json", message: errMessage(err) }, 400)
    }
    const validation = validateIngestBody(raw)
    if (!validation.ok) return ctx.json(validation.error, 400)

    const args: IngestEventArgs = {
      environment: validation.body.environment,
      envelope: validation.body.envelope,
      idempotencyKey: validation.body.idempotencyKey,
    }
    const result = await opts.driver.ingestEvent(args)
    if (!result.ok && result.reason === "manifest_not_registered") {
      return ctx.json(result, 200)
    }
    if (!result.ok) {
      return ctx.json(result, 502)
    }
    return ctx.json(result, 200)
  })

  app.post(`${base}/manifests`, async (ctx) => {
    if (opts.verifyRequest) {
      try {
        await opts.verifyRequest(ctx.req.raw)
      } catch (err) {
        return ctx.json({ error: "unauthorized", message: errMessage(err) }, 401)
      }
    }
    let raw: unknown
    try {
      raw = await ctx.req.json()
    } catch (err) {
      return ctx.json({ error: "invalid_json", message: errMessage(err) }, 400)
    }
    const validation = validateRegisterBody(raw)
    if (!validation.ok) return ctx.json(validation.error, 400)
    try {
      const result = await opts.driver.registerManifest({
        environment: validation.body.environment,
        manifest: validation.body.manifest as never, // structurally compatible
      })
      return ctx.json({ ok: true, versionId: result.versionId }, 200)
    } catch (err) {
      return ctx.json({ error: "register_failed", message: errMessage(err) }, 500)
    }
  })

  app.get(`${base}/manifests/:env`, async (ctx) => {
    if (opts.verifyRequest) {
      try {
        await opts.verifyRequest(ctx.req.raw)
      } catch (err) {
        return ctx.json({ error: "unauthorized", message: errMessage(err) }, 401)
      }
    }
    const env = ctx.req.param("env")
    if (!env || !ALLOWED_ENVS.has(env as EnvironmentName)) {
      return ctx.json(
        {
          error: "invalid_environment",
          message: `environment must be one of ${[...ALLOWED_ENVS].join(", ")}`,
        },
        400,
      )
    }
    const manifest = await opts.driver.getManifest({ environment: env as EnvironmentName })
    if (!manifest) {
      return ctx.json({ error: "not_found", environment: env }, 404)
    }
    return ctx.json({ environment: env, versionId: manifest.versionId, manifest }, 200)
  })

  return base
}

// ---- Validation ----

interface IngestBody {
  environment: EnvironmentName
  envelope: {
    name: string
    data: unknown
    metadata?: Record<string, unknown> & { eventId?: string }
    emittedAt: string
  }
  idempotencyKey?: string
}

function validateIngestBody(
  raw: unknown,
): { ok: true; body: IngestBody } | { ok: false; error: { error: string; message: string } } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: { error: "invalid_body", message: "expected JSON object" } }
  }
  const r = raw as Record<string, unknown>
  if (typeof r.environment !== "string" || !ALLOWED_ENVS.has(r.environment as EnvironmentName)) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: `"environment" must be one of ${[...ALLOWED_ENVS].join(", ")}`,
      },
    }
  }
  if (typeof r.envelope !== "object" || r.envelope === null) {
    return { ok: false, error: { error: "invalid_body", message: '"envelope" must be an object' } }
  }
  const envelope = r.envelope as Record<string, unknown>
  if (typeof envelope.name !== "string" || envelope.name.length === 0) {
    return {
      ok: false,
      error: { error: "invalid_body", message: '"envelope.name" must be a non-empty string' },
    }
  }
  if (typeof envelope.emittedAt !== "string" || envelope.emittedAt.length === 0) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: '"envelope.emittedAt" must be an ISO timestamp string',
      },
    }
  }
  if (
    envelope.metadata !== undefined &&
    (typeof envelope.metadata !== "object" || envelope.metadata === null)
  ) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: '"envelope.metadata" must be an object when supplied',
      },
    }
  }
  if (r.idempotencyKey !== undefined && typeof r.idempotencyKey !== "string") {
    return {
      ok: false,
      error: { error: "invalid_body", message: '"idempotencyKey" must be a string when supplied' },
    }
  }
  return {
    ok: true,
    body: {
      environment: r.environment as EnvironmentName,
      envelope: {
        name: envelope.name,
        data: envelope.data,
        metadata: envelope.metadata as Record<string, unknown> | undefined,
        emittedAt: envelope.emittedAt,
      },
      idempotencyKey: r.idempotencyKey as string | undefined,
    },
  }
}

interface RegisterBody {
  environment: EnvironmentName
  manifest: Record<string, unknown> & { versionId: string }
}

function validateRegisterBody(
  raw: unknown,
): { ok: true; body: RegisterBody } | { ok: false; error: { error: string; message: string } } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: { error: "invalid_body", message: "expected JSON object" } }
  }
  const r = raw as Record<string, unknown>
  if (typeof r.environment !== "string" || !ALLOWED_ENVS.has(r.environment as EnvironmentName)) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: `"environment" must be one of ${[...ALLOWED_ENVS].join(", ")}`,
      },
    }
  }
  if (typeof r.manifest !== "object" || r.manifest === null) {
    return { ok: false, error: { error: "invalid_body", message: '"manifest" must be an object' } }
  }
  const manifest = r.manifest as Record<string, unknown>
  if (typeof manifest.versionId !== "string" || manifest.versionId.length === 0) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: '"manifest.versionId" must be a non-empty string',
      },
    }
  }
  return {
    ok: true,
    body: {
      environment: r.environment as EnvironmentName,
      manifest: manifest as Record<string, unknown> & { versionId: string },
    },
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
