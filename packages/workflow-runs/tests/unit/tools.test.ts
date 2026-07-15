import {
  createToolRegistry,
  TOOL_PROVIDER_SELECTIONS_RESOURCE,
  type ToolContext,
} from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createWorkflowRunsToolServices,
  voyantToolContextContribution,
} from "../../src/mcp-runtime.js"
import { WorkflowRunnerRegistry } from "../../src/runner.js"
import { workflowRunnerRegistryRuntimePort } from "../../src/runtime-port.js"
import { workflowRunsService } from "../../src/service.js"
import {
  type WorkflowRunsToolContext,
  type WorkflowRunsToolServices,
  workflowRunsTools,
} from "../../src/tools.js"

afterEach(() => vi.restoreAllMocks())

const run = {
  id: "run_1",
  workflowName: "sync-products",
  trigger: "admin",
  correlationId: "correlation_1",
  tags: ["source:test"],
  status: "failed" as const,
  input: { full: true },
  result: null,
  error: { message: "failed", code: "SYNC_FAILED", stepName: "publish", stack: "secret" },
  parentRunId: null,
  triggeredByUserId: "user_1",
  resumeFromStep: null,
  startedAt: new Date("2026-07-15T10:00:00.000Z"),
  completedAt: new Date("2026-07-15T10:01:00.000Z"),
  durationMs: 60_000,
  createdAt: new Date("2026-07-15T10:00:00.000Z"),
  updatedAt: new Date("2026-07-15T10:01:00.000Z"),
}
const steps = [
  {
    id: "step_1",
    runId: run.id,
    stepName: "load",
    sequence: 1,
    status: "succeeded" as const,
    output: { count: 2 },
    error: null,
    startedAt: new Date("2026-07-15T10:00:00.000Z"),
    completedAt: new Date("2026-07-15T10:00:30.000Z"),
    durationMs: 30_000,
  },
  {
    id: "step_2",
    runId: run.id,
    stepName: "publish",
    sequence: 2,
    status: "failed" as const,
    output: null,
    error: { message: "failed", stack: "secret" },
    startedAt: new Date("2026-07-15T10:00:30.000Z"),
    completedAt: new Date("2026-07-15T10:01:00.000Z"),
    durationMs: 30_000,
  },
]

function context(
  service?: WorkflowRunsToolServices,
  actor: ToolContext["actor"] = "staff",
): WorkflowRunsToolContext {
  return {
    db: {},
    actor,
    audience: actor,
    tenantId: "operator_1",
    resolverScope: { locale: "en-GB", audience: actor, market: "default", actor },
    workflowRuns: service,
  }
}

function mockService(): WorkflowRunsToolServices {
  return {
    listRuns: vi.fn(async () => ({ data: [], total: 0, limit: 50, offset: 0 })),
    getRunById: vi.fn(async () => null),
    triggerWorkflow: vi.fn(async ({ workflowName }) => ({
      runId: "run_new",
      workflowName,
      status: "queued",
    })),
    retryRun: vi.fn(async ({ runId, mode }) => ({
      runId: "run_retry",
      parentRunId: runId,
      mode,
      resumeFromStep: mode === "resume" ? "publish" : null,
    })),
  }
}

describe("workflow-run Tools", () => {
  it("publishes typed reads and critical confirmation-gated writes", () => {
    const registry = createToolRegistry()
    registry.registerAll(workflowRunsTools)

    expect(
      registry
        .list()
        .map(({ name }) => name)
        .sort(),
    ).toEqual(["get_workflow_run", "list_workflow_runs", "retry_workflow_run", "trigger_workflow"])
    expect(registry.list().find(({ name }) => name === "list_workflow_runs")).toMatchObject({
      tier: "sensitive",
      requiredScopes: ["workflows:read"],
    })
    for (const name of ["trigger_workflow", "retry_workflow_run"]) {
      expect(registry.list().find((tool) => tool.name === name)).toMatchObject({
        tier: "destructive",
        riskPolicy: { destructive: true, reversible: false, confirmationRequired: true },
      })
    }
  })

  it("delegates to package services and denies non-staff callers", async () => {
    const service = mockService()
    const registry = createToolRegistry()
    registry.registerAll(workflowRunsTools)

    await expect(
      registry.dispatch(
        "trigger_workflow",
        { workflowName: "sync-products", input: { full: true } },
        context(service),
      ),
    ).resolves.toMatchObject({ runId: "run_new", workflowName: "sync-products" })
    expect(service.triggerWorkflow).toHaveBeenCalledWith({
      workflowName: "sync-products",
      input: { full: true },
    })
    await expect(
      registry.dispatch("list_workflow_runs", {}, context(service, "partner")),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
    await expect(
      registry.dispatch("list_workflow_runs", {}, context(undefined)),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })

  it("serializes summaries, redacts stacks, and dispatches registered runners", async () => {
    vi.spyOn(workflowRunsService, "listRuns").mockResolvedValue({
      data: [run],
      total: 1,
      limit: 50,
      offset: 0,
    })
    vi.spyOn(workflowRunsService, "getRunById").mockResolvedValue({ run, steps })
    const registry = new WorkflowRunnerRegistry()
    const trigger = vi.fn(async () => ({ runId: "run_triggered" }))
    const rerun = vi.fn(async () => ({ runId: "run_rerun" }))
    const resume = vi.fn(async () => ({ runId: "run_resume" }))
    registry.register({
      name: run.workflowName,
      idempotency: "unsafe",
      trigger,
      rerun,
      resume,
    })
    const service = createWorkflowRunsToolServices({
      db: {} as never,
      runners: registry,
      workflowProvider: "self-hosted",
      userId: "user_tool",
    })

    const listed = await service.listRuns({})
    expect(listed.data[0]).toMatchObject({
      id: run.id,
      startedAt: "2026-07-15T10:00:00.000Z",
    })
    expect(listed.data[0]).not.toHaveProperty("input")
    const detail = await service.getRunById(run.id)
    expect(detail?.run.error).toEqual({
      message: "failed",
      code: "SYNC_FAILED",
      stepName: "publish",
    })
    expect(detail?.steps[1]?.error).toEqual({ message: "failed" })

    await service.triggerWorkflow({ workflowName: run.workflowName, input: { full: true } })
    expect(trigger).toHaveBeenCalledWith(
      { full: true },
      expect.objectContaining({ triggeredByUserId: "user_tool" }),
    )
    await expect(service.retryRun({ runId: run.id, mode: "rerun" })).resolves.toMatchObject({
      runId: "run_rerun",
      mode: "rerun",
    })
    await expect(service.retryRun({ runId: run.id, mode: "resume" })).resolves.toMatchObject({
      runId: "run_resume",
      mode: "resume",
      resumeFromStep: "publish",
    })
    expect(resume).toHaveBeenCalledWith(
      run.input,
      expect.objectContaining({
        parentRunId: run.id,
        resumeFromStep: "publish",
        seedResults: { load: { count: 2 } },
      }),
    )
  })

  it.each([
    "voyant-cloud",
    "none",
    undefined,
  ])("fails management closed for provider %s", async (workflowProvider) => {
    const registry = new WorkflowRunnerRegistry()
    const trigger = vi.fn(async () => ({ runId: "run_forbidden" }))
    registry.register({
      name: run.workflowName,
      idempotency: "safe",
      trigger,
      rerun: async () => ({ runId: "rerun" }),
      resume: async () => ({ runId: "resume" }),
    })
    const service = createWorkflowRunsToolServices({
      db: {} as never,
      runners: registry,
      workflowProvider,
      userId: null,
    })

    await expect(service.triggerWorkflow({ workflowName: run.workflowName })).rejects.toMatchObject(
      { code: "AUTHORIZATION_DENIED" },
    )
    expect(trigger).not.toHaveBeenCalled()
  })

  it("receives provider authority from the generic MCP resource bag", async () => {
    const registry = new WorkflowRunnerRegistry()
    const trigger = vi.fn(async () => ({ runId: "run_contributed" }))
    registry.register({
      name: run.workflowName,
      idempotency: "safe",
      trigger,
      rerun: async () => ({ runId: "rerun" }),
      resume: async () => ({ runId: "resume" }),
    })
    const contribution = await voyantToolContextContribution.contribute({
      request: {
        get(key: string) {
          return key === "db" ? {} : key === "userId" ? "user_contributed" : undefined
        },
      },
      context: context(),
      resources: {
        [workflowRunnerRegistryRuntimePort.id]: registry,
        [TOOL_PROVIDER_SELECTIONS_RESOURCE]: { workflows: "self-hosted" },
      },
    })
    const service = contribution.workflowRuns as WorkflowRunsToolServices

    await service.triggerWorkflow({ workflowName: run.workflowName })
    expect(trigger).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ triggeredByUserId: "user_contributed" }),
    )
  })
})
