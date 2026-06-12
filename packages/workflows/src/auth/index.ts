// @voyantjs/workflows/auth
//
// Paired HMAC signer + verifier for the `X-Voyant-Dispatch-Auth`
// header on `POST /__voyant/workflow-step`. Both sides share a
// symmetric secret — suitable for local dev and single-region
// deployments; asymmetric signing (control-plane issuer + tenant
// public-key) is a later upgrade that keeps the same header shape.
//
// Built on Web Crypto (`crypto.subtle`), so it works unchanged in
// Node 20+, Cloudflare Workers, Deno, Bun, and browsers.
//
// Usage on the orchestrator side:
//
//   import { createHmacSigner } from "@voyantjs/workflows/auth";
//   const sign = await createHmacSigner(process.env.VOYANT_SIGNING_KEY!);
//   createDispatchStepHandler(script, { dispatcher, sign });
//
// Usage on the tenant side:
//
//   import { createHmacVerifier } from "@voyantjs/workflows/auth";
//   import { createStepHandler } from "@voyantjs/workflows/handler";
//   const verify = await createHmacVerifier(env.VOYANT_SIGNING_KEY);
//   export default { fetch: createStepHandler({ verifyRequest: verify }) };

export const AUTH_HEADER = "x-voyant-dispatch-auth" as const

/**
 * HMAC header carried on orchestrator → node-step-container dispatches
 * (`POST /step`). Signed over the raw request body with the shared
 * `VOYANT_WORKFLOW_STEP_AUTH_SECRET`. See `createCfContainerStepRunner`
 * (signing side) and `apps/workflows-node-step-container` (verifying side).
 */
export const STEP_AUTH_HEADER = "x-voyant-step-auth" as const

/**
 * HMAC header returned by the node-step-container on successful `/step`
 * responses. Signed over the raw JSON response body with the same
 * `VOYANT_WORKFLOW_STEP_AUTH_SECRET` so the orchestrator can reject
 * forged step journal entries before committing run state.
 */
export const STEP_RESPONSE_AUTH_HEADER = "x-voyant-step-response-auth" as const

/** Parse a comma-separated token/origin list env var into trimmed, non-empty entries. */
export function parseTokenList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Returns a verifier that accepts `Authorization: Bearer <token>`
 * where `<token>` matches any of the `validTokens` (case-sensitive,
 * constant-time compared). Usable as the `verifyRequest` dep on
 * `handleWorkerRequest` / `createStepHandler` for the public-facing
 * surface of an orchestrator or tenant Worker.
 *
 * Intended for dev + single-tenant deployments. Production should
 * issue per-tenant, short-lived tokens from a control plane.
 */
export function createBearerVerifier(validTokens: readonly string[]): (req: Request) => void {
  if (validTokens.length === 0) {
    throw new Error("createBearerVerifier: need at least one valid token")
  }
  return (req) => {
    const header = req.headers.get("authorization")
    if (!header) throw new Error("missing Authorization header")
    const match = /^Bearer (.+)$/.exec(header)
    if (!match) {
      throw new Error("Authorization header must use the Bearer scheme")
    }
    const presented = match[1]!
    for (const valid of validTokens) {
      if (constantTimeEquals(presented, valid)) return
    }
    throw new Error("bearer token does not match any configured value")
  }
}

/**
 * Constant-time string comparison. Does NOT early-return on length
 * mismatch: the loop always runs over the longer input (out-of-range
 * `charCodeAt` is NaN, which coerces to 0 under bitwise ops), and a
 * length mismatch only sets a diff bit. This avoids leaking how many
 * leading characters of a secret matched, or whether the length matched.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length, 1)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0)
  }
  return diff === 0
}

// ---- Fail-closed bearer auth resolution ----

/**
 * Error thrown by verifiers produced in this module. Carries an HTTP
 * `status` + machine-readable `code` so HTTP surfaces
 * (`handleWorkerRequest`, the node dashboard server, step handlers)
 * can map auth failures to the right response instead of a blanket 401.
 */
export class RequestAuthError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "RequestAuthError"
    this.status = status
    this.code = code
  }
}

export type BearerAuthDecision =
  | { ok: true }
  | { ok: false; status: number; error: string; message: string }

export interface BearerAuthOptions {
  /** Accepted bearer tokens. Empty/undefined = no auth configured. */
  tokens?: readonly string[]
  /**
   * Explicit local-dev opt-out. When `true` AND no tokens are
   * configured, requests are allowed through with a loud warning.
   * When `false`/unset and no tokens are configured, every request is
   * rejected with 503 `auth_not_configured` (fail closed).
   */
  allowUnauthenticated?: boolean
  /** Warning sink for the unauthenticated opt-out. Defaults to `console.warn`. */
  warn?: (message: string) => void
}

const UNAUTHENTICATED_WARNING =
  "[voyant-workflows] AUTH DISABLED: no bearer tokens are configured and " +
  "VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED is set. Every caller can trigger, read, " +
  "resume, and cancel workflow runs. This mode is for LOCAL DEVELOPMENT ONLY — " +
  "configure VOYANT_API_TOKENS before deploying."

/**
 * Build a transport-agnostic bearer authorizer from a raw
 * `Authorization` header value. Fail-closed semantics:
 *
 *   - tokens configured     → exact (constant-time) Bearer match or 401
 *   - no tokens + opt-out   → always allowed (warns loudly once, at creation)
 *   - no tokens, no opt-out → always 503 `auth_not_configured`
 */
export function createBearerAuthorizer(
  opts: BearerAuthOptions,
): (authorizationHeader: string | null | undefined) => BearerAuthDecision {
  const tokens = (opts.tokens ?? []).filter((t) => t.length > 0)
  if (tokens.length === 0) {
    if (opts.allowUnauthenticated) {
      ;(opts.warn ?? console.warn)(UNAUTHENTICATED_WARNING)
      return () => ({ ok: true })
    }
    return () => ({
      ok: false,
      status: 503,
      error: "auth_not_configured",
      message:
        "no bearer tokens are configured for this workflows API; set VOYANT_API_TOKENS " +
        "(or pass tokens explicitly), or opt out for local development with " +
        "VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED=1",
    })
  }
  return (header) => {
    if (!header) {
      return {
        ok: false,
        status: 401,
        error: "unauthorized",
        message: "missing Authorization header",
      }
    }
    const match = /^Bearer (.+)$/.exec(header)
    if (!match) {
      return {
        ok: false,
        status: 401,
        error: "unauthorized",
        message: "Authorization header must use the Bearer scheme",
      }
    }
    const presented = match[1]!
    for (const valid of tokens) {
      if (constantTimeEquals(presented, valid)) return { ok: true }
    }
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "bearer token does not match any configured value",
    }
  }
}

/**
 * Resolve a `verifyRequest` hook (the dep consumed by
 * `handleWorkerRequest` / `createStepHandler`) with fail-closed
 * defaults — the missing-token case yields a verifier that rejects
 * every request with a 503 `auth_not_configured` `RequestAuthError`
 * instead of `undefined` (which would skip auth entirely).
 *
 * Returns `undefined` (auth skipped) ONLY when no tokens are
 * configured AND `allowUnauthenticated` is explicitly set.
 */
export function resolveRequestVerifier(
  opts: BearerAuthOptions,
): ((req: Request) => void) | undefined {
  const tokens = (opts.tokens ?? []).filter((t) => t.length > 0)
  if (tokens.length === 0 && opts.allowUnauthenticated) {
    ;(opts.warn ?? console.warn)(UNAUTHENTICATED_WARNING)
    return undefined
  }
  const authorize = createBearerAuthorizer({ ...opts, allowUnauthenticated: false })
  return (req) => {
    const decision = authorize(req.headers.get("authorization"))
    if (!decision.ok) {
      throw new RequestAuthError(decision.status, decision.error, decision.message)
    }
  }
}

/** Returns a signer: `(body: string) => Promise<string>` (base64 HMAC-SHA256). */
export async function createHmacSigner(secret: string): Promise<(body: string) => Promise<string>> {
  const key = await importKey(secret, ["sign"])
  return async (body) => {
    const sig = await crypto.subtle.sign("HMAC", key, encode(body))
    return toBase64(sig)
  }
}

/**
 * Returns a verifier: `(req: Request) => Promise<void>`. Throws if:
 *   - the header is missing,
 *   - the signature is malformed,
 *   - the signature does not match the current body.
 *
 * The verifier consumes `req.body` via `req.text()`. Callers that
 * need the body downstream should pre-clone: `req.clone()` before
 * passing in.
 */
export async function createHmacVerifier(secret: string): Promise<(req: Request) => Promise<void>> {
  const key = await importKey(secret, ["verify"])
  return async (req) => {
    const header = req.headers.get(AUTH_HEADER)
    if (!header) {
      throw new Error(`missing ${AUTH_HEADER} header`)
    }
    let sig: ArrayBuffer
    try {
      sig = fromBase64(header)
    } catch {
      throw new Error(`malformed ${AUTH_HEADER} header (expected base64)`)
    }
    const body = await req.clone().text()
    const ok = await crypto.subtle.verify("HMAC", key, sig, encode(body))
    if (!ok) {
      throw new Error(`${AUTH_HEADER} signature does not match request body`)
    }
  }
}

/**
 * Returns a verifier over a raw body string + detached base64 HMAC
 * signature (the value of `STEP_AUTH_HEADER`). Suitable for servers
 * that have already buffered the request body (e.g. the node step
 * container). `crypto.subtle.verify` is constant-time; malformed
 * base64 or a missing signature simply yields `false`.
 */
export async function createHmacBodyVerifier(
  secret: string,
): Promise<(body: string, signatureBase64: string | null | undefined) => Promise<boolean>> {
  const key = await importKey(secret, ["verify"])
  return async (body, signatureBase64) => {
    if (!signatureBase64) return false
    let sig: ArrayBuffer
    try {
      sig = fromBase64(signatureBase64)
    } catch {
      return false
    }
    return crypto.subtle.verify("HMAC", key, sig, encode(body))
  }
}

// ---- Bundle URL origin policy ----

export type BundleUrlDecision = { ok: true } | { ok: false; message: string }

/**
 * Default bundle source: Cloudflare R2's S3 endpoint
 * (`<account>.r2.cloudflarestorage.com`), which is where deploy
 * pipelines stage `container.mjs` and the orchestrator mints
 * short-lived signed URLs. Anything else must be explicitly
 * allowlisted via `allowedOrigins`.
 */
const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com"

/**
 * Build an origin allowlist check for caller-supplied `bundle.url`
 * values (the node step container dynamically `import()`s the fetched
 * bytes, so an unrestricted URL is remote-code-execution-adjacent —
 * the SHA-256 hash pin is supplied by the same caller and is not a
 * security control on its own).
 *
 *   - `allowedOrigins` set (e.g. from `VOYANT_BUNDLE_ALLOWED_ORIGINS`):
 *     the URL's origin must match one of the entries exactly.
 *     Invalid entries throw at creation time (misconfiguration should
 *     fail loudly, not silently widen).
 *   - unset/empty: only HTTPS URLs on `*.r2.cloudflarestorage.com`
 *     are allowed — the production bundle source.
 */
export function createBundleUrlPolicy(opts?: {
  allowedOrigins?: readonly string[]
}): (url: string) => BundleUrlDecision {
  const entries = (opts?.allowedOrigins ?? []).filter((entry) => entry.length > 0)
  const allowed = new Set<string>()
  for (const entry of entries) {
    let parsed: URL
    try {
      parsed = new URL(entry)
    } catch {
      throw new Error(`createBundleUrlPolicy: invalid origin in allowlist: "${entry}"`)
    }
    allowed.add(parsed.origin)
  }
  return (url) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { ok: false, message: `bundle url is not a valid URL: "${url}"` }
    }
    if (allowed.size > 0) {
      if (allowed.has(parsed.origin)) return { ok: true }
      return {
        ok: false,
        message:
          `bundle url origin "${parsed.origin}" is not in the configured allowlist ` +
          "(VOYANT_BUNDLE_ALLOWED_ORIGINS)",
      }
    }
    if (parsed.protocol === "https:" && parsed.hostname.endsWith(R2_HOST_SUFFIX)) {
      return { ok: true }
    }
    return {
      ok: false,
      message:
        `bundle url origin "${parsed.origin}" rejected: with no VOYANT_BUNDLE_ALLOWED_ORIGINS ` +
        `configured, only https://*${R2_HOST_SUFFIX} bundle sources are allowed`,
    }
  }
}

// ---- Internals ----

async function importKey(
  secret: string,
  usages: readonly ("sign" | "verify")[],
): Promise<CryptoKey> {
  if (secret.length === 0) {
    throw new Error("HMAC secret must be a non-empty string")
  }
  return crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    ...usages,
  ])
}

/**
 * Encode to a freshly-allocated ArrayBuffer. TextEncoder's Uint8Array
 * is typed as `Uint8Array<ArrayBufferLike>` under recent TS lib, which
 * doesn't satisfy the `BufferSource` param of `subtle.sign/verify`.
 * Copying into a new ArrayBuffer sidesteps the nominal mismatch.
 */
function encode(s: string): ArrayBuffer {
  const view = new TextEncoder().encode(s)
  const buf = new ArrayBuffer(view.byteLength)
  new Uint8Array(buf).set(view)
  return buf
}

function toBase64(buffer: ArrayBuffer): string {
  // btoa is available in every modern runtime (Node 16+, Workers, browsers).
  const bytes = new Uint8Array(buffer)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function fromBase64(s: string): ArrayBuffer {
  const bin = atob(s)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}
