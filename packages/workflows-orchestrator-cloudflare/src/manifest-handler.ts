// HTTP handlers for `/api/manifests*`. Mounted by the worker before the
// existing `/api/runs/*` routes; both share the same auth.
//
//   POST /api/manifests              { environment, manifest } → { ok, versionId }
//   GET  /api/manifests/:env                                   → manifest | 404
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §8.2.

import type { CfManifestStore } from "./manifest-kv-store.js"

const ALLOWED_ENVS = new Set(["production", "preview", "development"])

export interface ManifestHandlerDeps {
  manifestStore: CfManifestStore
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

/**
 * Handle `POST /api/manifests`. Body: `{ environment, manifest }`.
 * `manifest.versionId` is the registered key. Returns `{ ok: true, versionId }`.
 */
export async function handleRegisterManifest(
  req: Request,
  deps: ManifestHandlerDeps,
): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return json(400, {
      error: "invalid_json",
      message: err instanceof Error ? err.message : String(err),
    })
  }
  if (typeof body !== "object" || body === null) {
    return json(400, { error: "invalid_body", message: "expected JSON object" })
  }

  const { environment, manifest } = body as {
    environment?: unknown
    manifest?: unknown
  }
  if (typeof environment !== "string" || !ALLOWED_ENVS.has(environment)) {
    return json(400, {
      error: "invalid_body",
      message: `"environment" must be one of ${[...ALLOWED_ENVS].join(", ")}`,
    })
  }
  if (typeof manifest !== "object" || manifest === null) {
    return json(400, { error: "invalid_body", message: '"manifest" must be an object' })
  }
  const versionId = (manifest as { versionId?: unknown }).versionId
  if (typeof versionId !== "string" || versionId.length === 0) {
    return json(400, {
      error: "invalid_body",
      message: '"manifest.versionId" must be a non-empty string',
    })
  }

  try {
    const result = await deps.manifestStore.registerManifest({
      environment,
      versionId,
      manifest: manifest as Record<string, unknown>,
    })
    return json(200, { ok: true, versionId: result.versionId })
  } catch (err) {
    deps.logger?.("error", "manifest registration failed", {
      environment,
      versionId,
      error: err instanceof Error ? err.message : String(err),
    })
    return json(500, {
      error: "register_failed",
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Handle `GET /api/manifests/:env`. Returns the current manifest envelope
 * or 404 if no manifest is registered.
 */
export async function handleGetManifest(
  environment: string,
  deps: ManifestHandlerDeps,
): Promise<Response> {
  if (!ALLOWED_ENVS.has(environment)) {
    return json(400, {
      error: "invalid_environment",
      message: `environment must be one of ${[...ALLOWED_ENVS].join(", ")}`,
    })
  }
  const envelope = await deps.manifestStore.getCurrent(environment)
  if (!envelope) {
    return json(404, { error: "not_found", environment })
  }
  return json(200, envelope)
}

// ---- Internal ----

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, x-voyant-protocol",
    },
  })
}
