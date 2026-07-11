import { __resetRegistry, getWorkflow, workflow } from "@voyant-travel/workflows"
import { handleStepRequest, type WorkflowResolver } from "@voyant-travel/workflows/handler"
import { describe, expect, it } from "vitest"
import { createHttpStepHandler } from "../http-step-handler.js"

describe("createHttpStepHandler", () => {
  it("posts the workflow request as JSON and parses the response", async () => {
    __resetRegistry()
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })

    const handler = createHttpStepHandler({
      resolveTarget() {
        return {
          url: "https://tenant.internal/__voyant/workflow-step",
          async fetch(req: Request): Promise<Response> {
            const body = await req.json()
            const workflowResolver: WorkflowResolver = {
              resolve: (workflowId) => getWorkflow(workflowId),
            }
            const out = await handleStepRequest(body, { workflowResolver })
            return new Response(JSON.stringify(out.body), {
              status: out.status,
              headers: { "content-type": "application/json" },
            })
          },
        }
      },
    })

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
        random: { seed: "seed", consumed: 0 },
        clock: { basis: 0, consumed: [] },
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta: {
        tenantId: "tnt_t",
        projectId: "prj_t",
        organizationId: "org_t",
      },
      runMeta: {
        number: 1,
        attempt: 1,
        triggeredBy: { kind: "api" },
        tags: [],
        startedAt: 0,
      },
    })

    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toBe(1)
    }
  })

  it("maps transport-level errors to a stable error envelope", async () => {
    const handler = createHttpStepHandler({
      resolveTarget() {
        return {
          url: "https://tenant.internal/__voyant/workflow-step",
          async fetch(): Promise<Response> {
            throw new Error("boom")
          },
        }
      },
    })

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
        random: { seed: "seed", consumed: 0 },
        clock: { basis: 0, consumed: [] },
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta: {
        tenantId: "tnt_t",
        projectId: "prj_t",
        organizationId: "org_t",
      },
      runMeta: {
        number: 1,
        attempt: 1,
        triggeredBy: { kind: "api" },
        tags: [],
        startedAt: 0,
      },
    })

    expect(out.status).toBe(502)
    expect("error" in out.body && out.body.error).toBe("tenant_unreachable")
  })
})
