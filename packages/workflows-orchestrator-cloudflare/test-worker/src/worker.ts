// Test-only Worker used by the miniflare (@cloudflare/vitest-pool-workers)
// integration tests in this package. Mounts `handleDurableObjectRequest`
// and `handleDurableObjectAlarm` from @voyant-travel/workflows-orchestrator-cloudflare
// against a real Durable Object namespace, and resolves step handlers
// in-process via @voyant-travel/workflows/handler so we're testing the DO
// layer end-to-end without needing a dispatch namespace.

import { workflow } from "@voyant-travel/workflows"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import {
  createInlineDispatcher,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
} from "@voyant-travel/workflows-orchestrator-cloudflare"

// Register a couple of workflows at module load so any test DO can
// drive them via the step handler.
workflow<{ n: number }, { doubled: number }>({
  id: "double",
  async run(input) {
    return { doubled: input.n * 2 }
  },
})

workflow<void, { done: true }>({
  id: "sleep-then-done",
  async run(_i, ctx) {
    await ctx.sleep("200ms")
    return { done: true }
  },
})

interface Env {
  TEST_WORKFLOW_RUN_DO: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleWorkerRequest(request, {
      runDO: env.TEST_WORKFLOW_RUN_DO,
    })
  },
} satisfies ExportedHandler<Env>

export class TestWorkflowRunDO implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    // Unused in tests — silence unused-var linters.
    void this.env
  }

  async fetch(request: Request): Promise<Response> {
    return handleDurableObjectRequest(request, this.deps())
  }

  async alarm(): Promise<void> {
    return handleDurableObjectAlarm(this.deps())
  }

  private deps() {
    return {
      storage: this.state.storage,
      // In-process step handler — no dispatch namespace needed.
      dispatcher: createInlineDispatcher(
        async (req: Parameters<typeof handleStepRequest>[0], opts?: { signal?: AbortSignal }) =>
          handleStepRequest(req, {}, opts),
      ),
    }
  }
}
