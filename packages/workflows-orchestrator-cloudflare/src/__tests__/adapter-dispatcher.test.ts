import { workflow } from "@voyant-travel/workflows"
import { describe, expect, it } from "vitest"
import { createServiceBindingDispatcher, type ServiceBindingLike } from "../index.js"
import { inProcessBinding, tenantMeta } from "./adapter-test-support.js"

describe("createServiceBindingDispatcher", () => {
  it("posts the WorkflowStepRequest as JSON and parses the response", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const binding = inProcessBinding()
    const handler = createServiceBindingDispatcher({ binding })({})
    const out = await handler({
      protocolVersion: 1,
      runId: "run_x",
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
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toBe(1)
    }
  })

  it("maps non-200 step responses to error envelopes", async () => {
    // No workflow registered → step handler returns 404.
    const binding = inProcessBinding()
    const handler = createServiceBindingDispatcher({ binding })({})
    const out = await handler({
      protocolVersion: 1,
      runId: "run_x",
      workflowId: "nope",
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
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(404)
    expect("error" in out.body && out.body.error).toBe("workflow_not_found")
  })

  it("attaches a dispatch-auth header when a signer is provided", async () => {
    let capturedAuthHeader: string | null = null
    const binding: ServiceBindingLike = {
      async fetch(req) {
        capturedAuthHeader = req.headers.get("x-voyant-dispatch-auth")
        return new Response(JSON.stringify({ status: "completed", output: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    }
    const handler = createServiceBindingDispatcher({
      binding,
      sign: (body) => `sig:${body.length}`,
    })({})
    await handler({
      protocolVersion: 1,
      runId: "run_x",
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
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(capturedAuthHeader).toMatch(/^sig:\d+$/)
  })
})

// ---- handleWorkerRequest end-to-end ----
