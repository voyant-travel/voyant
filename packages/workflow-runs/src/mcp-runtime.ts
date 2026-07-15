import {
  defineToolContextContribution,
  requireService,
  TOOL_PROVIDER_SELECTIONS_RESOURCE,
  ToolError,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import type { WorkflowRunnerRegistryRuntime } from "./runtime-port.js"
import { workflowRunnerRegistryRuntimePort } from "./runtime-port.js"
import type { WorkflowRun, WorkflowRunErrorPayload, WorkflowRunStep } from "./schema.js"
import { workflowRunsService } from "./service.js"
import type {
  ListWorkflowRunsToolInput,
  RetryWorkflowRunToolInput,
  TriggerWorkflowToolInput,
  WorkflowRunDetailDto,
  WorkflowRunStepDto,
  WorkflowRunSummaryDto,
  WorkflowRunsToolServices,
} from "./tools.js"

export * from "./tools.js"

type WorkflowRunsMcpContext = Context<{
  Bindings: Record<string, unknown>
  Variables: { db?: PostgresJsDatabase; userId?: string }
}>

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["workflowRuns"],
  async contribute({ request, context, resources }) {
    const c = request as WorkflowRunsMcpContext
    const db = requireService((c.get("db") ?? context.db) as PostgresJsDatabase | undefined, "db")
    const runners = requireService(
      resources[workflowRunnerRegistryRuntimePort.id] as WorkflowRunnerRegistryRuntime | undefined,
      workflowRunnerRegistryRuntimePort.id,
    )
    const providerSelections = resources[TOOL_PROVIDER_SELECTIONS_RESOURCE] as
      | Readonly<Record<string, string>>
      | undefined
    const userId = c.get("userId") ?? null

    return {
      workflowRuns: createWorkflowRunsToolServices({
        db,
        runners,
        workflowProvider: providerSelections?.workflows,
        userId,
      }),
    }
  },
})

export function createWorkflowRunsToolServices(input: {
  db: PostgresJsDatabase
  runners: WorkflowRunnerRegistryRuntime
  workflowProvider: string | undefined
  userId: string | null
}): WorkflowRunsToolServices {
  return {
    async listRuns(query: ListWorkflowRunsToolInput) {
      const result = await workflowRunsService.listRuns(input.db, query)
      return { ...result, data: result.data.map(workflowRunSummaryDto) }
    },
    async getRunById(runId) {
      const detail = await workflowRunsService.getRunById(input.db, runId)
      if (!detail) return null
      return {
        run: workflowRunDetailDto(detail.run),
        steps: detail.steps.map(workflowRunStepDto),
      }
    },
    async triggerWorkflow(request: TriggerWorkflowToolInput) {
      assertSelfHostedManagement(input.workflowProvider)
      const runner = registeredRunner(input.runners, request.workflowName)
      if (!runner.trigger) {
        throw new ToolError(
          `Workflow "${runner.name}" does not expose trigger capability.`,
          "MISSING_SERVICE",
          { workflowName: runner.name, capability: "trigger" },
        )
      }
      const { runId } = await runner.trigger(request.input ?? {}, {
        triggeredByUserId: input.userId,
        correlationId: request.correlationId ?? null,
        tags: request.tags ?? [],
        idempotencyKey: request.idempotencyKey ?? null,
      })
      return { runId, workflowName: runner.name, status: "queued" }
    },
    async retryRun(request: RetryWorkflowRunToolInput) {
      assertSelfHostedManagement(input.workflowProvider)
      const detail = await workflowRunsService.getRunById(input.db, request.runId)
      if (!detail) {
        throw new ToolError(`Workflow run "${request.runId}" was not found.`, "NOT_FOUND", {
          runId: request.runId,
        })
      }
      const runner = registeredRunner(input.runners, detail.run.workflowName)
      if (request.mode === "rerun") {
        if (runner.idempotency === "resume-only") {
          throw new ToolError(
            `Workflow "${runner.name}" is resume-only and cannot be rerun from the beginning.`,
            "INVALID_INPUT",
            { runId: request.runId, idempotency: runner.idempotency },
          )
        }
        if (runner.canRerun) {
          const guard = await runner.canRerun(detail.run.input)
          if (!guard.ok) {
            throw new ToolError(guard.reason, "AUTHORIZATION_DENIED", {
              runId: request.runId,
              workflowName: runner.name,
            })
          }
        }
        const { runId } = await runner.rerun(detail.run.input, {
          parentRunId: detail.run.id,
          triggeredByUserId: input.userId,
          correlationId: detail.run.correlationId,
          tags: detail.run.tags,
        })
        return {
          runId,
          parentRunId: detail.run.id,
          mode: request.mode,
          resumeFromStep: null,
        }
      }

      if (detail.run.status !== "failed") {
        throw new ToolError(
          `Workflow run "${request.runId}" has status "${detail.run.status}"; only failed runs can resume.`,
          "INVALID_INPUT",
          { runId: request.runId, status: detail.run.status },
        )
      }
      const failedStep = detail.steps.find((step) => step.status === "failed")
      if (!failedStep) {
        throw new ToolError(
          `Workflow run "${request.runId}" has no recorded failed step.`,
          "INVALID_INPUT",
          { runId: request.runId },
        )
      }
      const seedResults: Record<string, unknown> = {}
      for (const step of detail.steps) {
        if (step.sequence >= failedStep.sequence) break
        if (step.status !== "succeeded" && step.status !== "skipped") {
          throw new ToolError(
            `Workflow step "${step.stepName}" is incomplete; the run cannot resume past it.`,
            "INVALID_INPUT",
            { runId: request.runId, stepName: step.stepName, status: step.status },
          )
        }
        seedResults[step.stepName] = step.output ?? null
      }
      const { runId } = await runner.resume(detail.run.input, {
        parentRunId: detail.run.id,
        triggeredByUserId: input.userId,
        correlationId: detail.run.correlationId,
        tags: detail.run.tags,
        resumeFromStep: failedStep.stepName,
        seedResults,
      })
      return {
        runId,
        parentRunId: detail.run.id,
        mode: request.mode,
        resumeFromStep: failedStep.stepName,
      }
    },
  }
}

function assertSelfHostedManagement(provider: string | undefined): void {
  if (provider === "self-hosted") return
  throw new ToolError(
    "Workflow management Tools require deployment.providers.workflows to be self-hosted.",
    "AUTHORIZATION_DENIED",
    { workflowProvider: provider ?? "missing" },
  )
}

function registeredRunner(runners: WorkflowRunnerRegistryRuntime, workflowName: string) {
  const runner = runners.get(workflowName)
  if (!runner) {
    throw new ToolError(`No runner is registered for workflow "${workflowName}".`, "NOT_FOUND", {
      workflowName,
    })
  }
  return runner
}

function workflowRunSummaryDto(run: WorkflowRun): WorkflowRunSummaryDto {
  return {
    id: run.id,
    workflowName: run.workflowName,
    trigger: run.trigger,
    correlationId: run.correlationId,
    tags: run.tags,
    status: run.status,
    parentRunId: run.parentRunId,
    triggeredByUserId: run.triggeredByUserId,
    resumeFromStep: run.resumeFromStep,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
  }
}

function workflowRunDetailDto(run: WorkflowRun): WorkflowRunDetailDto {
  return {
    ...workflowRunSummaryDto(run),
    input: run.input as WorkflowRunDetailDto["input"],
    result: run.result as WorkflowRunDetailDto["result"],
    error: workflowErrorDto(run.error),
  }
}

function workflowRunStepDto(step: WorkflowRunStep): WorkflowRunStepDto {
  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    sequence: step.sequence,
    status: step.status,
    output: step.output as WorkflowRunStepDto["output"],
    error: workflowErrorDto(step.error),
    startedAt: step.startedAt.toISOString(),
    completedAt: step.completedAt?.toISOString() ?? null,
    durationMs: step.durationMs,
  }
}

function workflowErrorDto(error: WorkflowRunErrorPayload | null) {
  if (!error) return null
  return {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.stepName ? { stepName: error.stepName } : {}),
  }
}
