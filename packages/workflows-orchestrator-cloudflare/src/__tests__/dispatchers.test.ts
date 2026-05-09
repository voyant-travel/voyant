// Unit tests for the four StepDispatcher factories. Each factory is a
// thin wrapper around `createHttpStepHandler` (or, for inline, a
// passthrough); the value of these tests is asserting that the
// abstraction over WfP / service binding / inline / HTTP behaves the
// way the run DO expects — same StepHandler shape, correct fetch
// target, no leakage of WfP-specific concepts into other modes.

import { __resetRegistry, workflow } from "@voyantjs/workflows"
import { handleStepRequest } from "@voyantjs/workflows/handler"
import type { StepHandler, WorkflowStepRequest } from "@voyantjs/workflows-orchestrator"
import { afterEach, describe, expect, it } from "vitest"

import {
  createHttpDispatcher,
  createInlineDispatcher,
  createServiceBindingDispatcher,
  createWfpDispatcher,
  type DispatchNamespaceLike,
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

  it("works end-to-end with handleStepRequest from @voyantjs/workflows/handler", async () => {
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

describe("createWfpDispatcher", () => {
  it("uses ctx.tenantScript to pick the dispatch-namespace binding", async () => {
    registerDouble()
    const seen: string[] = []
    const namespace: DispatchNamespaceLike = {
      get(name) {
        seen.push(name)
        return {
          async fetch(req) {
            const body = (await req.json()) as WorkflowStepRequest
            const out = await handleStepRequest(body)
            return new Response(JSON.stringify(out.body), { status: out.status })
          },
        }
      },
    }
    const dispatcher = createWfpDispatcher({ namespace })
    const handler = dispatcher({ tenantScript: "tenant-aaa", workflowId: "wf" })
    await handler({ ...baseRequest, input: { n: 3 } })
    expect(seen).toEqual(["tenant-aaa"])
  })

  it("defaults to empty tenantScript when ctx omits it", async () => {
    registerDouble()
    const seen: string[] = []
    const namespace: DispatchNamespaceLike = {
      get(name) {
        seen.push(name)
        return {
          async fetch(req) {
            const body = (await req.json()) as WorkflowStepRequest
            const out = await handleStepRequest(body)
            return new Response(JSON.stringify(out.body), { status: out.status })
          },
        }
      },
    }
    const dispatcher = createWfpDispatcher({ namespace })
    const handler = dispatcher({})
    await handler({ ...baseRequest, input: { n: 1 } })
    expect(seen).toEqual([""])
  })
})
