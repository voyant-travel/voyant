// Reference tenant Worker for Voyant Workflows.
//
// voyant-cloud's deploy pipeline composes this file with the user's
// workflow bundle and uploads the combined Worker to the
// orchestrator's dispatch namespace. One Worker script per
// `(tenant, version)` — the script's bindings (R2, KV, container
// namespace) are inherited from the outer orchestrator deployment.
//
// Responsibilities:
//   1. Import the user's bundle so `workflow()` side-effects register
//      definitions into the process-local registry.
//   2. Verify the orchestrator's HMAC dispatch header
//      (`X-Voyant-Dispatch-Auth`) so only the legitimate orchestrator
//      can invoke the tenant.
//   3. Handle `POST /__voyant/workflow-step` via the SDK's
//      `createStepHandler`.
//   4. Wire `nodeStepRunner` to a Cloudflare Container pool so steps
//      declared with `runtime: "node"` dispatch to a sandboxed Node
//      runtime.
//   5. Resolve per-tenant bundles to short-TTL R2 presigned URLs so
//      the container can fetch the matching `container.mjs` on cold
//      start and verify its SHA-256 against a KV-stored manifest hash.

// IMPORTANT: the user's bundle must be staged next to this file as
// `./bundle.mjs` before `wrangler deploy`. voyant-cloud's deploy
// pipeline handles that substitution; for local experimentation you
// can symlink or copy your own `voyant workflows build` output.
import "./bundle.mjs"

import { createHmacSigner, createHmacVerifier } from "@voyantjs/workflows/auth"
import { createStepHandler, type StepRunner } from "@voyantjs/workflows/handler"
import {
  type ContainerNamespaceLike,
  createCfContainerStepRunner,
  createR2Presigner,
} from "@voyantjs/workflows-orchestrator-cloudflare"

export interface Env {
  /** DO namespace backing the `NodeStepContainer` class in the orchestrator Worker. */
  NODE_STEP_POOL: DurableObjectNamespace
  /** R2 bucket containing per-tenant `<projectId>/<workflowVersion>/container.mjs`. */
  BUNDLE_R2: R2Bucket
  /** KV namespace mapping `<projectId>:<workflowVersion>` → SHA-256 hex of the bundle. */
  BUNDLE_HASHES: KVNamespace
  /** R2 account id (32-char hex). */
  R2_ACCOUNT_ID: string
  /** R2 access key id for the read-only token used to presign bundle URLs. */
  R2_ACCESS_KEY_ID: string
  /** R2 secret access key, paired with R2_ACCESS_KEY_ID. */
  R2_SECRET_ACCESS_KEY: string
  /** R2 bucket name — must match `BUNDLE_R2`'s bucket_name in wrangler.jsonc. */
  R2_BUCKET: string
  /** Shared secret with the orchestrator for the dispatch HMAC header. */
  VOYANT_DISPATCH_SECRET: string
  /** Shared secret with the Node step container for step dispatch HMAC. */
  VOYANT_WORKFLOW_STEP_AUTH_SECRET: string
}

// Per-isolate state. The handler + runners stay alive across
// invocations within the same V8 isolate, so the rate limiter's
// in-memory buckets and the container namespace addressing survive
// between dispatches.
let handler: ((req: Request) => Promise<Response>) | undefined

function containerNamespace(namespace: unknown): ContainerNamespaceLike {
  return namespace as never
}

async function buildHandler(env: Env): Promise<(req: Request) => Promise<Response>> {
  const presign = createR2Presigner({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  })

  const nodeStepRunner: StepRunner = createCfContainerStepRunner({
    namespace: containerNamespace(env.NODE_STEP_POOL),
    sign: await createHmacSigner(env.VOYANT_WORKFLOW_STEP_AUTH_SECRET),
    resolveBundle: async ({ projectId, workflowVersion }) => {
      const key = `${projectId}/${workflowVersion}/container.mjs`
      const url = await presign({ key, expiresIn: 300 })
      const hash = await env.BUNDLE_HASHES.get(`${projectId}:${workflowVersion}`)
      if (!hash) {
        throw new Error(
          `tenant-worker: no bundle hash registered for ${projectId}:${workflowVersion}`,
        )
      }
      return { url, hash }
    },
  })

  const verifyRequest = await createHmacVerifier(env.VOYANT_DISPATCH_SECRET)

  return createStepHandler({
    verifyRequest,
    nodeStepRunner,
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!handler) handler = await buildHandler(env)
    return handler(req)
  },
} satisfies ExportedHandler<Env>
