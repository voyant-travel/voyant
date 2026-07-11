import { beforeEach, describe, expect, it, vi } from "vitest"
import { snapshotWorkflowWaitpoint } from "../../protocol/index.js"
import { emptyJournal } from "../../runtime/journal.js"
import type { RunTrigger } from "../../types.js"
import { __resetRegistry, workflow } from "../../workflow.js"
import {
  buildResumeStepRequest,
  createStepHandler,
  handleStepRequest,
  type WorkflowStepRequest,
} from "../index.js"

beforeEach(() => {
  __resetRegistry()
})

function mkRequest(overrides: Partial<WorkflowStepRequest> = {}): WorkflowStepRequest {
  const triggeredBy: RunTrigger = { kind: "api" }
  return {
    protocolVersion: 1,
    runId: "run_test_1",
    workflowId: "wf",
    workflowVersion: "v1",
    invocationCount: 1,
    input: {},
    journal: emptyJournal(),
    environment: "development",
    deadline: Date.now() + 30_000,
    tenantMeta: {
      tenantId: "tnt_x",
      projectId: "prj_x",
      organizationId: "org_x",
    },
    runMeta: {
      number: 1,
      attempt: 1,
      triggeredBy,
      tags: [],
      startedAt: Date.now(),
    },
    ...overrides,
  }
}

function post(body: unknown): Request {
  return new Request("https://tenant.example.com/__voyant/workflow-step", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

describe("createStepHandler (fetch adapter)", () => {
  it("rejects non-POST with 405", async () => {
    const handler = createStepHandler()
    const res = await handler(new Request("https://t.example/__voyant/workflow-step"))
    expect(res.status).toBe(405)
    expect((await res.json()).error).toBe("method_not_allowed")
  })

  it("returns 400 on invalid JSON", async () => {
    const handler = createStepHandler()
    const req = new Request("https://t.example/__voyant/workflow-step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("invalid_json")
  })

  it("returns 401 when verifyRequest throws", async () => {
    const handler = createStepHandler({
      verifyRequest: () => {
        throw new Error("bad signature")
      },
    })
    const res = await handler(post(mkRequest()))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("unauthorized")
    expect(body.message).toBe("bad signature")
  })

  it("returns 426 for a protocol-version mismatch", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest({ protocolVersion: 2 as 1 })))
    expect(res.status).toBe(426)
    expect((await res.json()).error).toBe("protocol_version_mismatch")
  })

  it("returns 404 when the workflow id is not registered", async () => {
    const handler = createStepHandler()
    const res = await handler(post(mkRequest()))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("workflow_not_found")
  })

  it("returns 400 on missing required fields", async () => {
    const handler = createStepHandler()
    const res = await handler(post({ protocolVersion: 1 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("invalid_request")
  })

  it("runs a simple workflow body end-to-end and returns completed", async () => {
    workflow<{ name: string }, { greeting: string }>({
      id: "wf",
      async run(input) {
        return { greeting: `hello ${input.name}` }
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest({ input: { name: "ada" } })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("completed")
    expect(body.output).toEqual({ greeting: "hello ada" })
  })

  it("runs steps in-process and records them in the journal", async () => {
    workflow<number, number>({
      id: "wf",
      async run(input, ctx) {
        const plus1 = await ctx.step("plus1", () => input + 1)
        const doubled = await ctx.step("doubled", () => plus1 * 2)
        return doubled
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest({ input: 3 })))
    const body = await res.json()
    expect(body.status).toBe("completed")
    expect(body.output).toBe(8)
    expect(Object.keys(body.journal.stepResults).sort()).toEqual(["doubled", "plus1"])
  })

  it("returns a 'waiting' response when the body hits a waitpoint", async () => {
    workflow<void, unknown>({
      id: "wf",
      async run(_i, ctx) {
        return await ctx.waitForEvent("greet")
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest()))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe("waiting")
    expect(body.waitpoints).toHaveLength(1)
    expect(body.waitpoints[0].kind).toBe("EVENT")
    expect(body.waitpoints[0].meta.eventType).toBe("greet")
  })

  it("returns 'failed' with a serialized error when the body throws", async () => {
    workflow<void, unknown>({
      id: "wf",
      async run() {
        throw new Error("boom")
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest()))
    const body = await res.json()
    expect(body.status).toBe("failed")
    expect(body.error.message).toBe("boom")
  })

  it("runs compensations LIFO when a later step throws", async () => {
    const compensated: string[] = []
    workflow<void, unknown>({
      id: "wf",
      async run(_i, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              compensated.push("a")
            },
          },
          async () => "a-out",
        )
        await ctx.step(
          "b",
          {
            compensate: async () => {
              compensated.push("b")
            },
          },
          async () => "b-out",
        )
        await ctx.step("c", async () => {
          throw new Error("boom")
        })
      },
    })
    const handler = createStepHandler()
    const res = await handler(post(mkRequest()))
    const body = await res.json()
    expect(body.status).toBe("compensated")
    expect(compensated).toEqual(["b", "a"])
    expect(body.compensations.map((c: { stepId: string }) => c.stepId)).toEqual(["b", "a"])
  })

  it("resumes with a pre-populated journal (no re-executing of completed steps)", async () => {
    let sideEffect = 0
    workflow<void, { total: number }>({
      id: "wf",
      async run(_i, ctx) {
        const a = await ctx.step("a", () => {
          sideEffect += 1
          return 10
        })
        const b = await ctx.step("b", () => a + 5)
        return { total: b }
      },
    })
    const journal = emptyJournal()
    journal.stepResults.a = {
      attempt: 1,
      status: "ok",
      output: 10,
      startedAt: 0,
      finishedAt: 1,
    }
    const handler = createStepHandler()
    const res = await handler(post(mkRequest({ journal, invocationCount: 2 })))
    const body = await res.json()
    expect(body.status).toBe("completed")
    expect(body.output).toEqual({ total: 15 })
    // Step "a" was already in the journal, so its side effect ran 0 additional times.
    expect(sideEffect).toBe(0)
  })

  it("continues a Cloud-managed resume activation from a persisted waitpoint", async () => {
    let beforeWaitExecutions = 0
    let afterWaitExecutions = 0
    workflow<void, { greeting: string; after: number }>({
      id: "wf",
      async run(_i, ctx) {
        await ctx.step("before-wait", () => {
          beforeWaitExecutions += 1
          return "ready"
        })
        const event = await ctx.waitForEvent<{ name: string }>("greet", { timeout: "1h" })
        const after = await ctx.step("after-wait", () => {
          afterWaitExecutions += 1
          return 7
        })
        return { greeting: `hello ${event!.name}`, after }
      },
    })

    const first = await handleStepRequest(mkRequest())
    expect(first.status).toBe(200)
    expect(first.body.status).toBe("waiting")
    if (first.body.status !== "waiting") throw new Error("expected waiting")
    expect(beforeWaitExecutions).toBe(1)
    expect(afterWaitExecutions).toBe(0)

    const pending = first.body.waitpoints[0]!
    const storedWaitpoint = snapshotWorkflowWaitpoint(pending, 1_700_000_000_000)
    const built = buildResumeStepRequest({
      ...mkRequest({
        journal: first.body.journal,
        invocationCount: 2,
      }),
      pendingWaitpoints: [storedWaitpoint],
      waitpointKey: storedWaitpoint.key,
      resumePayload: { name: "ada" },
      resolvedAt: 1_700_000_001_000,
      workflowReleaseId: "rel_123",
      bundle: { key: "bundles/workflow.mjs", hash: "sha256:abc123" },
      freshness: { dispatchedAt: 1_700_000_000_900, attempt: 1 },
    })

    expect(built.ok).toBe(true)
    if (!built.ok) throw new Error(built.message)
    expect(built.waitpoint).toMatchObject({
      id: pending.clientWaitpointId,
      key: `EVENT:${pending.clientWaitpointId}`,
      kind: "EVENT",
      eventName: "greet",
      timeoutMs: 3_600_000,
    })
    expect(built.request.activation).toMatchObject({
      kind: "resume",
      workflowReleaseId: "rel_123",
      waitpoint: built.waitpoint,
    })

    const resumed = await handleStepRequest(built.request)
    expect(resumed.status).toBe(200)
    expect(resumed.body.status).toBe("completed")
    if (resumed.body.status !== "completed") throw new Error("expected completed")
    expect(resumed.body.output).toEqual({ greeting: "hello ada", after: 7 })
    expect(beforeWaitExecutions).toBe(1)
    expect(afterWaitExecutions).toBe(1)
  })

  it("rejects a resume activation when the selected waitpoint is not pending", () => {
    const built = buildResumeStepRequest({
      ...mkRequest(),
      pendingWaitpoints: [
        {
          clientWaitpointId: "event:greet:1",
          kind: "EVENT",
          meta: { eventType: "greet" },
        },
      ],
      waitpointId: "event:other:1",
      resumePayload: { name: "ada" },
    })

    expect(built).toMatchObject({
      ok: false,
      code: "waitpoint_not_found",
    })
  })

  it("threads a custom now() into step durations", async () => {
    workflow<void, unknown>({
      id: "wf",
      async run(_i, ctx) {
        return await ctx.step("s", () => "ok")
      },
    })
    let clock = 1_000_000
    const handler = createStepHandler({ now: () => (clock += 100) })
    const res = await handler(post(mkRequest()))
    const body = await res.json()
    const entry = body.journal.stepResults.s
    expect(entry.finishedAt - entry.startedAt).toBe(100)
  })
})

describe("handleStepRequest (transport-free)", () => {
  it("uses the explicit workflow resolver instead of the process-global registry", async () => {
    const definition = workflow<void, string>({
      id: "wf",
      async run() {
        return "resolved explicitly"
      },
    })
    __resetRegistry()
    const resolve = vi.fn(() => definition)

    const out = await handleStepRequest(mkRequest(), {
      workflowResolver: { resolve },
    })

    expect(out.status).toBe(200)
    expect("output" in out.body && out.body.output).toBe("resolved explicitly")
    expect(resolve).toHaveBeenCalledWith("wf")
  })

  it("does not fall back to the global registry when an explicit resolver misses", async () => {
    workflow<void, string>({
      id: "wf",
      async run() {
        return "global"
      },
    })

    const out = await handleStepRequest(mkRequest(), {
      workflowResolver: { resolve: () => undefined },
    })

    expect(out.status).toBe(404)
    expect("error" in out.body && out.body.error).toBe("workflow_not_found")
  })

  it("returns body + status without touching Request/Response", async () => {
    workflow<void, string>({
      id: "wf",
      async run() {
        return "ok"
      },
    })
    const out = await handleStepRequest(mkRequest())
    expect(out.status).toBe(200)
    expect("output" in out.body && out.body.output).toBe("ok")
  })

  it("surfaces validation errors without serializing to JSON", async () => {
    const out = await handleStepRequest({ protocolVersion: 1 })
    expect(out.status).toBe(400)
    expect("error" in out.body && out.body.error).toBe("invalid_request")
  })
})
