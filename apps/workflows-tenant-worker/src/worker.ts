// Reference tenant Worker for Voyant Workflows.
//
// voyant-cloud's deploy pipeline composes this file with the user's
// workflow bundle and uploads the combined Worker to the
// orchestrator's dispatch namespace. One Worker script per
// `(tenant, version)` — the script's bindings are inherited from the
// outer orchestrator deployment.
//
// Responsibilities:
//   1. Import the user's bundle so `workflow()` side-effects register
//      definitions into the process-local registry.
//   2. Verify the orchestrator's HMAC dispatch header
//      (`X-Voyant-Dispatch-Auth`) so only the legitimate orchestrator
//      can invoke the tenant.
//   3. Handle `POST /__voyant/workflow-step` via the SDK's
//      `createStepHandler`.
//   4. Execute steps through the SDK's node-only handler.

// IMPORTANT: the user's bundle must be staged next to this file as
// `./bundle.mjs` before `wrangler deploy`. voyant-cloud's deploy
// pipeline handles that substitution; for local experimentation you
// can symlink or copy your own `voyant workflows build` output.
import "./bundle.mjs"

import { createHmacVerifier } from "@voyant-travel/workflows/auth"
import { createStepHandler } from "@voyant-travel/workflows/handler"

export interface Env {
  /** Shared secret with the orchestrator for the dispatch HMAC header. */
  VOYANT_DISPATCH_SECRET: string
}

// Per-isolate state. The handler + runners stay alive across
// invocations within the same V8 isolate, so the rate limiter's
// in-memory buckets and the container namespace addressing survive
// between dispatches.
let handler: ((req: Request) => Promise<Response>) | undefined

async function buildHandler(env: Env): Promise<(req: Request) => Promise<Response>> {
  const verifyRequest = await createHmacVerifier(env.VOYANT_DISPATCH_SECRET)

  return createStepHandler({
    verifyRequest,
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!handler) handler = await buildHandler(env)
    return handler(req)
  },
} satisfies ExportedHandler<Env>
