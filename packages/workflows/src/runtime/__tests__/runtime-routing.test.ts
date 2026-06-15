import { beforeEach, describe, expect, it } from "vitest"
import { __resetRegistry, getWorkflow, workflow } from "../../workflow.js"
import { executeWorkflowStep, type StepRunner } from "../executor.js"
import { emptyJournal } from "../journal.js"

beforeEach(() => {
  __resetRegistry()
})

interface RouteLog {
  stepId: string
}

function makeTracker(log: RouteLog[]): StepRunner {
  return async ({ stepId, attempt, fn, stepCtx }) => {
    log.push({ stepId })
    const output = await fn(stepCtx)
    return { attempt, status: "ok", output, startedAt: 0, finishedAt: 0 }
  }
}

function baseReq(workflowId: string) {
  return {
    runId: "run_test",
    workflowId,
    workflowVersion: "test",
    input: undefined as unknown,
    journal: emptyJournal(),
    invocationCount: 1,
    environment: {
      run: {
        id: "run_test",
        number: 1,
        attempt: 1,
        triggeredBy: { kind: "api" as const },
        tags: [],
        startedAt: 0,
      },
      workflow: { id: workflowId, version: "test" },
      environment: { name: "development" as const },
      project: { id: "prj", slug: "p" },
      organization: { id: "org", slug: "o" },
    },
    triggeredBy: { kind: "api" as const },
    runStartedAt: 0,
    tags: [],
  }
}

describe("node-only step execution", () => {
  it("routes steps without options.runtime through the node runner", async () => {
    workflow<void, string>({
      id: "rt.default",
      async run(_, ctx) {
        return await ctx.step("a", () => "ok")
      },
    })

    const log: RouteLog[] = []
    const def = getWorkflow("rt.default")!
    const response = await executeWorkflowStep(def, {
      ...baseReq("rt.default"),
      stepRunner: makeTracker(log),
    })

    expect(response.status).toBe("completed")
    expect(log).toEqual([{ stepId: "a" }])
  })

  it("accepts runtime=node as an explicit node-only annotation", async () => {
    workflow<void, string>({
      id: "rt.node",
      async run(_, ctx) {
        const a = await ctx.step("default-step", () => "a")
        const b = await ctx.step("node-step", { runtime: "node" }, () => "b")
        return `${a}${b}`
      },
    })

    const log: RouteLog[] = []
    const def = getWorkflow("rt.node")!
    const response = await executeWorkflowStep(def, {
      ...baseReq("rt.node"),
      stepRunner: makeTracker(log),
    })

    expect(response.status).toBe("completed")
    if (response.status === "completed") {
      expect(response.output).toBe("ab")
    }
    expect(log).toEqual([{ stepId: "default-step" }, { stepId: "node-step" }])
  })

  it("fails clearly when legacy runtime=edge is requested", async () => {
    workflow<void, string>({
      id: "rt.edge",
      async run(_, ctx) {
        return await ctx.step(
          "legacy-edge",
          { runtime: "edge", retry: { max: 0 } } as never,
          () => "x",
        )
      },
    })

    const def = getWorkflow("rt.edge")!
    const response = await executeWorkflowStep(def, {
      ...baseReq("rt.edge"),
      stepRunner: makeTracker([]),
    })

    expect(response.status).toBe("failed")
    if (response.status === "failed") {
      expect(response.error.code).toBe("UNSUPPORTED_WORKFLOW_RUNTIME")
    }
  })

  it("stamps the runtime on the returned journal entry", async () => {
    workflow<void, string>({
      id: "rt.stamp",
      async run(_, ctx) {
        const a = await ctx.step("node-a", () => "A")
        const b = await ctx.step("node-b", { runtime: "node" }, () => "B")
        return `${a}${b}`
      },
    })

    const def = getWorkflow("rt.stamp")!
    const req = baseReq("rt.stamp")
    const response = await executeWorkflowStep(def, {
      ...req,
      stepRunner: makeTracker([]),
    })

    expect(response.status).toBe("completed")
    const journal = response.journal
    expect(journal.stepResults["node-a"]!.runtime).toBe("node")
    expect(journal.stepResults["node-b"]!.runtime).toBe("node")
  })
})
