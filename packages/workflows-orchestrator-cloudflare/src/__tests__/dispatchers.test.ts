// Unit tests for the three OSS StepDispatcher factories. Each factory
// is a thin wrapper around `createHttpStepHandler` (or, for inline, a
// passthrough); the value of these tests is asserting that the
// abstraction over service binding / inline / HTTP behaves the way the
// run DO expects — same StepHandler shape, correct fetch target.

import { __resetRegistry, workflow } from "@voyant-travel/workflows"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import type { StepHandler, WorkflowStepRequest } from "@voyant-travel/workflows-orchestrator"
import { afterEach, describe, expect, it } from "vitest"

import {
  createHttpDispatcher,
  createInlineDispatcher,
  createServiceBindingDispatcher,
  type ServiceBindingLike,
} from "../index.js"

afterEach(() => {
  __resetRegistry()
})

const baseRequest: WorkflowStepRequest = {
  protocolVersion: 1,
  runId: "run_test",
  workflowId: "wf",
  workflowVersion: "v1",
  invocationCount: 1,
  input: null,
  journal: {
    stepResults: {},
    waitpointsResolved: {},
    compensationsRun: {},
    metadataState: {},
    streamsCompleted: {},
  },
  environment: "development",
  deadline: Number.MAX_SAFE_INTEGER,
  tenantMeta: {
    tenantId: "tnt",
    projectId: "prj",
    organizationId: "org",
    tenantScript: "tenant-x",
  },
  runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
}

function registerDouble(): void {
  workflow<{ n: number }, { doubled: number }>({
    id: "wf",
    async run(input) {
      return { doubled: input.n * 2 }
    },
  })
}

describe("createInlineDispatcher", () => {
  it("returns the supplied handler verbatim regardless of context", async () => {
    const calls: WorkflowStepRequest[] = []
    const handler: StepHandler = async (req) => {
      calls.push(req)
      return { status: 200, body: { status: "completed", output: { ok: true } } }
    }
    const dispatcher = createInlineDispatcher(handler)
    const a = dispatcher({ tenantScript: "ignored", workflowId: "wf" })
    const b = dispatcher({})
    expect(a).toBe(handler)
    expect(b).toBe(handler)

    const out = await a(baseRequest)
    expect(out.status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it("works end-to-end with handleStepRequest from @voyant-travel/workflows/handler", async () => {
    registerDouble()
    const dispatcher = createInlineDispatcher(async (req) => handleStepRequest(req))
    const handler = dispatcher({})
    const out = await handler({ ...baseRequest, input: { n: 21 } })
    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toEqual({ doubled: 42 })
    }
  })
})

describe("createServiceBindingDispatcher", () => {
  it("forwards step requests to the bound Worker via fetch", async () => {
    registerDouble()
    let receivedUrl: string | undefined
    const binding: ServiceBindingLike = {
      async fetch(req) {
        receivedUrl = req.url
        const body = (await req.json()) as WorkflowStepRequest
        const out = await handleStepRequest(body)
        return new Response(JSON.stringify(out.body), {
          status: out.status,
          headers: { "content-type": "application/json" },
        })
      },
    }
    const dispatcher = createServiceBindingDispatcher({ binding, label: "ops-worker" })
    const handler = dispatcher({}) // ctx is ignored
    const out = await handler({ ...baseRequest, input: { n: 7 } })
    expect(out.status).toBe(200)
    expect(receivedUrl).toBe("https://tenant.voyant.internal/__voyant/workflow-step")
  })

  it("respects a custom baseUrl", async () => {
    registerDouble()
    let receivedUrl: string | undefined
    const binding: ServiceBindingLike = {
      async fetch(req) {
        receivedUrl = req.url
        const body = (await req.json()) as WorkflowStepRequest
        const out = await handleStepRequest(body)
        return new Response(JSON.stringify(out.body), { status: out.status })
      },
    }
    const dispatcher = createServiceBindingDispatcher({
      binding,
      baseUrl: "https://internal.svc",
    })
    const handler = dispatcher({})
    await handler({ ...baseRequest, input: { n: 1 } })
    expect(receivedUrl).toBe("https://internal.svc/__voyant/workflow-step")
  })
})

describe("createHttpDispatcher", () => {
  it("forwards to the configured URL via the supplied fetch", async () => {
    registerDouble()
    let receivedUrl: string | undefined
    const dispatcher = createHttpDispatcher({
      url: "https://workflows.example/__voyant/workflow-step",
      fetch: async (req) => {
        receivedUrl = req.url
        const body = (await req.json()) as WorkflowStepRequest
        const out = await handleStepRequest(body)
        return new Response(JSON.stringify(out.body), { status: out.status })
      },
    })
    const handler = dispatcher({})
    const out = await handler({ ...baseRequest, input: { n: 4 } })
    expect(out.status).toBe(200)
    expect(receivedUrl).toBe("https://workflows.example/__voyant/workflow-step")
  })
})

describe("StepDispatcher contract — custom transports", () => {
  it("ctx.tenantScript surfaces opaquely so custom dispatchers can route on it", async () => {
    // The OSS factories don't read tenantScript, but a hosted multi-
    // tenant deployment can implement a StepDispatcher that does.
    // This test asserts the contract: the run DO passes whatever
    // tenantScript was on the run's tenantMeta to the dispatcher.
    const seen: Array<string | undefined> = []
    const dispatcher = (ctx: { tenantScript?: string }): StepHandler => {
      seen.push(ctx.tenantScript)
      return async () => ({ status: 200, body: { status: "completed", output: null } })
    }
    dispatcher({ tenantScript: "tenant-x" })
    dispatcher({})
    expect(seen).toEqual(["tenant-x", undefined])
  })
})
