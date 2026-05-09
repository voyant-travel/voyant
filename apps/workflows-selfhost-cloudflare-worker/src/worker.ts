// Single-tenant self-host Cloudflare Worker for Voyant Workflows.
//
// Unlike the Workers-for-Platforms target, this Worker imports the
// workflow bundle directly and resolves every step invocation in-process.
// The public `/api/runs/*` surface and the per-run Durable Object model
// stay the same, so the control-plane contract does not change.

// IMPORTANT: the workflow bundle must be staged next to this file as
// `./bundle.mjs` before `wrangler deploy`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — bundle.mjs is staged at deploy time, may not exist in source.
import "./bundle.mjs"

import { Container } from "@cloudflare/containers"
import { createBearerVerifier } from "@voyantjs/workflows/auth"
import { handleStepRequest, type StepRunner } from "@voyantjs/workflows/handler"
import { createInMemoryRateLimiter } from "@voyantjs/workflows/rate-limit"
import type { StepHandler } from "@voyantjs/workflows-orchestrator"
import {
  createCfContainerStepRunner,
  createInlineDispatcher,
  createR2Presigner,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type StepDispatcher,
} from "@voyantjs/workflows-orchestrator-cloudflare"

export interface Env {
  WORKFLOW_RUN_DO: DurableObjectNamespace
  NODE_STEP_POOL: DurableObjectNamespace
  BUNDLE_R2: R2Bucket
  BUNDLE_HASHES: KVNamespace
  VOYANT_API_TOKENS?: string
  R2_ACCOUNT_ID?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET?: string
}

let stepHandler: StepHandler | undefined
let dispatcher: StepDispatcher | undefined

function buildStepHandler(env: Env): StepHandler {
  const rateLimiter = createInMemoryRateLimiter()
  const nodeStepRunner = createOptionalNodeStepRunner(env)
  return (req, opts) =>
    handleStepRequest(
      req,
      {
        rateLimiter,
        nodeStepRunner,
      },
      opts,
    )
}

function createOptionalNodeStepRunner(env: Env): StepRunner | undefined {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    return undefined
  }

  const presign = createR2Presigner({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  })

  return createCfContainerStepRunner({
    namespace: env.NODE_STEP_POOL as unknown as Parameters<
      typeof createCfContainerStepRunner
    >[0]["namespace"],
    resolveBundle: async ({ projectId, workflowVersion }) => {
      const key = `${projectId}/${workflowVersion}/container.mjs`
      const url = await presign({ key, expiresIn: 300 })
      const hash = await env.BUNDLE_HASHES.get(`${projectId}:${workflowVersion}`)
      if (!hash) {
        throw new Error(
          `selfhost-cloudflare: no bundle hash registered for ${projectId}:${workflowVersion}`,
        )
      }
      return { url, hash }
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tokens = (env.VOYANT_API_TOKENS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    return handleWorkerRequest(request, {
      runDO: env.WORKFLOW_RUN_DO,
      verifyRequest: tokens.length > 0 ? createBearerVerifier(tokens) : undefined,
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

export class NodeStepContainer extends Container<Env> {
  defaultPort = 8080
  sleepAfter = "10m"
}
