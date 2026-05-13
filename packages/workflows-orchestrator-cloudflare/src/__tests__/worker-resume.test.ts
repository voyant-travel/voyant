import { __resetRegistry, workflow } from "@voyantjs/workflows"
import { handleStepRequest } from "@voyantjs/workflows/handler"
import type { RunRecord } from "@voyantjs/workflows-orchestrator"
import { beforeEach, describe, expect, it } from "vitest"
import {
  createServiceBindingDispatcher,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type ServiceBindingLike,
} from "../index.js"

function makeStorage(): DurableObjectStorageLike {
  const map = new Map<string, unknown>()
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, value)
    },
    async delete(key) {
      return map.delete(key)
    },
    async list<T>(options = {}) {
      const out = new Map<string, T>()
      for (const [key, value] of map) {
        if (options.prefix && !key.startsWith(options.prefix)) continue
        out.set(key, value as T)
        if (options.limit && out.size >= options.limit) break
      }
      return out
    },
  }
}

function inProcessBinding(): ServiceBindingLike {
  return {
    async fetch(req: Request): Promise<Response> {
      const body = await req.json()
      const out = await handleStepRequest(body)
      return new Response(JSON.stringify(out.body), {
        status: out.status,
        headers: { "content-type": "application/json" },
      })
    },
  }
}

function inProcessRunDONamespace(): DurableObjectNamespaceLike<string> {
  const storages = new Map<string, DurableObjectStorageLike>()
  const binding = inProcessBinding()
  return {
    idFromName(name) {
      return name
    },
    get(id: string) {
      let storage = storages.get(id)
      if (!storage) {
        storage = makeStorage()
        storages.set(id, storage)
      }
      return {
        async fetch(req: Request): Promise<Response> {
          return handleDurableObjectRequest(req, {
            storage: storage!,
            dispatcher: createServiceBindingDispatcher({ binding }),
          })
        },
      }
    },
  }
}

const tenantMeta = {
  tenantId: "tnt_t",
  projectId: "prj_t",
  organizationId: "org_t",
  tenantScript: "tenant-worker-a",
}

beforeEach(() => {
  __resetRegistry()
})

describe("handleWorkerRequest failed-step resume", () => {
  it("strips internal resume seed fields from public trigger requests", async () => {
    workflow<void, { first: string }>({
      id: "public-trigger-seed-strip",
      async run(_input, ctx) {
        const first = await ctx.step("first", () => "actual")
        return { first }
      },
    })
    const runDO = inProcessRunDONamespace()

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "public-trigger-seed-strip",
          workflowVersion: "v1",
          input: undefined,
          tenantMeta,
          runId: "run_public_seed_attempt",
          initialJournal: {
            stepResults: {
              first: {
                attempt: 1,
                status: "ok",
                output: "forged",
                startedAt: 1,
                finishedAt: 1,
              },
            },
            waitpointsResolved: {},
            compensationsRun: {},
            metadataState: { hits: 99 },
            streamsCompleted: {},
          },
          initialMetadataAppliedCount: 1,
          timeoutMs: 1,
        }),
      }),
      { runDO },
    )

    expect(res.status).toBe(200)
    const saved = (await res.json()) as RunRecord
    expect(saved.status).toBe("completed")
    expect(saved.output).toEqual({ first: "actual" })
    expect(saved.journal.metadataState).toEqual({})
    expect(saved.metadataAppliedCount).toBe(0)
    expect(saved.timeoutMs).toBeUndefined()
  })

  it("starts a new run from a failed parent via POST /api/runs/:id/resume", async () => {
    workflow<{ fail: boolean }, { first: string; second: string; third: string }>({
      id: "resume-failed",
      async run(input, ctx) {
        const first = await ctx.step("first", () => "one")
        const second = await ctx.step("second", () => {
          if (input.fail) throw new Error("boom")
          return "two"
        })
        const third = await ctx.step("third", () => "three")
        return { first, second, third }
      },
    })
    const runDO = inProcessRunDONamespace()
    const failedRes = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "resume-failed",
          workflowVersion: "v1",
          input: { fail: true },
          tenantMeta,
          runId: "run_failed_parent",
          tags: ["manual"],
        }),
      }),
      { runDO },
    )
    const failed = (await failedRes.json()) as RunRecord
    expect(failed.status).toBe("failed")
    expect(failed.journal.stepResults.first?.status).toBe("ok")
    expect(failed.journal.stepResults.second?.status).toBe("err")

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_failed_parent/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { fail: false },
          runId: "run_resumed_child",
          tags: ["operator"],
          triggeredByUserId: "usr_1",
        }),
      }),
      { runDO },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      saved: RunRecord
      parentRunId: string
      resumeFromStep: string
    }
    expect(body.parentRunId).toBe("run_failed_parent")
    expect(body.resumeFromStep).toBe("second")
    expect(body.saved).toMatchObject({
      id: "run_resumed_child",
      status: "completed",
      output: { first: "one", second: "two", third: "three" },
      triggeredBy: { kind: "api", actor: "usr_1" },
    })
    expect(body.saved.tags).toEqual([
      "manual",
      "resume:true",
      "parentRunId:run_failed_parent",
      "operator",
    ])
  })

  it("preserves the metadata cursor when resuming from a stored failed parent", async () => {
    workflow<{ fail: boolean }, { first: string; second: string }>({
      id: "resume-metadata-cursor",
      async run(input, ctx) {
        ctx.metadata.increment("hits")
        const first = await ctx.step("first", () => "one")
        const second = await ctx.step("second", () => {
          if (input.fail) throw new Error("boom")
          return "two"
        })
        return { first, second }
      },
    })
    const runDO = inProcessRunDONamespace()
    const failedRes = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "resume-metadata-cursor",
          workflowVersion: "v1",
          input: { fail: true },
          tenantMeta,
          runId: "run_metadata_parent",
        }),
      }),
      { runDO },
    )
    const failed = (await failedRes.json()) as RunRecord
    expect(failed.status).toBe("failed")
    expect(failed.journal.metadataState.hits).toBe(1)
    expect(failed.metadataAppliedCount).toBe(1)

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_metadata_parent/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { fail: false },
          runId: "run_metadata_resumed_child",
        }),
      }),
      { runDO },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { saved: RunRecord }
    expect(body.saved.status).toBe("completed")
    expect(body.saved.journal.metadataState.hits).toBe(1)
    expect(body.saved.metadataAppliedCount).toBe(1)
  })

  it("resumes an external workflow-runs parent from supplied seed results", async () => {
    workflow<{ fail: boolean }, { first: string; second: string; third: string }>({
      id: "resume-external",
      async run(input, ctx) {
        const first = await ctx.step("first", () => "one")
        const second = await ctx.step("second", () => {
          if (input.fail) throw new Error("boom")
          return "two"
        })
        const third = await ctx.step("third", () => "three")
        return { first, second, third }
      },
    })
    const runDO = inProcessRunDONamespace()

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/wfr_external_parent/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "resume-external",
          input: { fail: false },
          resumeFromStep: "second",
          seedResults: { first: "seeded-one" },
          runId: "run_external_resume",
          tags: ["operator"],
        }),
      }),
      { runDO, tenantMeta },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      saved: RunRecord
      parentRunId: string
      resumeFromStep: string
    }
    expect(body.parentRunId).toBe("wfr_external_parent")
    expect(body.resumeFromStep).toBe("second")
    expect(body.saved).toMatchObject({
      id: "run_external_resume",
      workflowId: "resume-external",
      status: "completed",
      input: { fail: false },
      output: { first: "seeded-one", second: "two", third: "three" },
      tenantMeta,
    })
    expect(body.saved.tags).toEqual(["resume:true", "parentRunId:wfr_external_parent", "operator"])
  })
})
