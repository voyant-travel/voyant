// Single-tenant self-host Cloudflare Worker for Voyant Workflows.
//
// Unlike the Workers-for-Platforms target, this Worker imports the
// workflow bundle directly and resolves every step invocation in-process.
// The public `/api/runs/*` surface and the per-run Durable Object model
// stay the same, so the control-plane contract does not change.

// IMPORTANT: the workflow bundle must be staged next to this file as
// `./bundle.mjs` before `wrangler deploy`.
import "./bundle.mjs"

import { parseTokenList, resolveRequestVerifier } from "@voyant-travel/workflows/auth"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import { createInMemoryRateLimiter } from "@voyant-travel/workflows/rate-limit"
import type { StepHandler } from "@voyant-travel/workflows-orchestrator"
import {
  createInlineDispatcher,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type StepDispatcher,
} from "@voyant-travel/workflows-orchestrator-cloudflare"

export interface Env {
  WORKFLOW_RUN_DO: DurableObjectNamespace
  VOYANT_API_TOKENS?: string
  VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED?: string
}

let stepHandler: StepHandler | undefined
let dispatcher: StepDispatcher | undefined

function buildStepHandler(_env: Env): StepHandler {
  const rateLimiter = createInMemoryRateLimiter()
  return (req, opts) =>
    handleStepRequest(
      req,
      {
        rateLimiter,
      },
      opts,
    )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleWorkerRequest(request, {
      runDO: env.WORKFLOW_RUN_DO,
      verifyRequest: resolveRequestVerifier({
        tokens: parseTokenList(env.VOYANT_API_TOKENS),
        allowUnauthenticated: env.VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED === "1",
      }),
    })
  },
} satisfies ExportedHandler<Env>

export class WorkflowRunDO implements DurableObject {
  private readonly state: DurableObjectState
  private readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    return handleDurableObjectRequest(request, this.deps())
  }

  async alarm(): Promise<void> {
    await handleDurableObjectAlarm(this.deps())
  }

  private deps() {
    return {
      storage: this.state.storage,
      dispatcher: this.resolveDispatcher(),
    }
  }

  private resolveDispatcher(): StepDispatcher {
    if (!dispatcher) {
      if (!stepHandler) stepHandler = buildStepHandler(this.env)
      dispatcher = createInlineDispatcher(stepHandler)
    }
    return dispatcher
  }
}
