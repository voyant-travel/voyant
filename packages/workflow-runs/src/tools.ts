import {
  defineTool,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  ToolError,
} from "@voyant-travel/tools"
import { z } from "zod"

const workflowStatusSchema = z.enum(["running", "succeeded", "failed", "cancelled"])
const workflowStepStatusSchema = z.enum([
  "running",
  "succeeded",
  "failed",
  "skipped",
  "compensated",
])
const workflowErrorSchema = z
  .object({
    message: z.string(),
    code: z.string().optional(),
    stepName: z.string().optional(),
  })
  .nullable()

const workflowRunSummarySchema = z.object({
  id: z.string(),
  workflowName: z.string(),
  trigger: z.string(),
  correlationId: z.string().nullable(),
  tags: z.array(z.string()),
  status: workflowStatusSchema,
  parentRunId: z.string().nullable(),
  triggeredByUserId: z.string().nullable(),
  resumeFromStep: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
})

const workflowRunDetailSchema = workflowRunSummarySchema.extend({
  input: z.json().nullable(),
  result: z.json().nullable(),
  error: workflowErrorSchema,
})

const workflowRunStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stepName: z.string(),
  sequence: z.number().int(),
  status: workflowStepStatusSchema,
  output: z.json().nullable(),
  error: workflowErrorSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
})

const listWorkflowRunsInputSchema = z.object({
  workflowName: z.string().trim().min(1).optional(),
  status: workflowStatusSchema.optional(),
  tag: z.string().trim().min(1).optional(),
  parentRunId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
})
const getWorkflowRunInputSchema = z.object({
  runId: z.string().trim().min(1).describe("Recorded workflow run id."),
})
const triggerWorkflowInputSchema = z.object({
  workflowName: z.string().trim().min(1).describe("Registered provider-neutral workflow name."),
  input: z.json().optional().describe("JSON input passed to the registered workflow runner."),
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
  correlationId: z.string().trim().min(1).max(255).optional(),
  tags: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
})
const retryWorkflowRunInputSchema = z.object({
  runId: z.string().trim().min(1).describe("Recorded workflow run id to retry."),
  mode: z
    .enum(["rerun", "resume"])
    .describe("rerun starts from the beginning; resume starts at the recorded failed step."),
})

export type WorkflowRunSummaryDto = z.infer<typeof workflowRunSummarySchema>
export type WorkflowRunDetailDto = z.infer<typeof workflowRunDetailSchema>
export type WorkflowRunStepDto = z.infer<typeof workflowRunStepSchema>
export type ListWorkflowRunsToolInput = z.infer<typeof listWorkflowRunsInputSchema>
export type TriggerWorkflowToolInput = z.infer<typeof triggerWorkflowInputSchema>
export type RetryWorkflowRunToolInput = z.infer<typeof retryWorkflowRunInputSchema>

export interface WorkflowRunsToolServices {
  listRuns(input: ListWorkflowRunsToolInput): Promise<{
    data: WorkflowRunSummaryDto[]
    total: number
    limit: number
    offset: number
  }>
  getRunById(runId: string): Promise<{
    run: WorkflowRunDetailDto
    steps: WorkflowRunStepDto[]
  } | null>
  triggerWorkflow(input: TriggerWorkflowToolInput): Promise<{
    runId: string
    workflowName: string
    status: "queued"
  }>
  retryRun(input: RetryWorkflowRunToolInput): Promise<{
    runId: string
    parentRunId: string
    mode: "rerun" | "resume"
    resumeFromStep: string | null
  }>
}

export type WorkflowRunsToolContext = ToolContext & {
  workflowRuns?: WorkflowRunsToolServices
}

function workflowRuns(ctx: WorkflowRunsToolContext): WorkflowRunsToolServices {
  if (ctx.actor !== "staff" || ctx.audience !== "staff") {
    throw new ToolError(
      "Workflow-run tools are restricted to staff grants.",
      "AUTHORIZATION_DENIED",
      { actor: ctx.actor, audience: ctx.audience },
    )
  }
  return requireService(ctx.workflowRuns, "workflowRuns")
}

export const listWorkflowRunsTool = defineTool<
  ListWorkflowRunsToolInput,
  Awaited<ReturnType<WorkflowRunsToolServices["listRuns"]>>,
  WorkflowRunsToolContext
>({
  name: "list_workflow_runs",
  description:
    "List recorded workflow-run summaries with status, workflow, tag, parent, and pagination filters. Staff-only and read-only.",
  inputSchema: listWorkflowRunsInputSchema,
  outputSchema: z.object({
    data: z.array(workflowRunSummarySchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
  requiredScopes: ["workflows:read"],
  tier: "sensitive",
  riskPolicy: READ_ONLY_RISK,
  async handler(input, ctx) {
    return workflowRuns(ctx).listRuns(input)
  },
})

export const getWorkflowRunTool = defineTool<
  z.infer<typeof getWorkflowRunInputSchema>,
  { run: WorkflowRunDetailDto; steps: WorkflowRunStepDto[] },
  WorkflowRunsToolContext
>({
  name: "get_workflow_run",
  description:
    "Read one recorded workflow run, its JSON input/result, redacted error, and ordered steps. Staff-only and may contain sensitive operational data.",
  inputSchema: getWorkflowRunInputSchema,
  outputSchema: z.object({ run: workflowRunDetailSchema, steps: z.array(workflowRunStepSchema) }),
  requiredScopes: ["workflows:read"],
  tier: "sensitive",
  riskPolicy: READ_ONLY_RISK,
  async handler({ runId }, ctx) {
    const result = await workflowRuns(ctx).getRunById(runId)
    if (!result) {
      throw new ToolError(`Workflow run "${runId}" was not found.`, "NOT_FOUND", { runId })
    }
    return result
  },
})

export const triggerWorkflowTool = defineTool<
  TriggerWorkflowToolInput,
  Awaited<ReturnType<WorkflowRunsToolServices["triggerWorkflow"]>>,
  WorkflowRunsToolContext
>({
  name: "trigger_workflow",
  description:
    "Trigger an explicitly registered workflow in a self-hosted workflow deployment. Workflow effects are unbounded, so explicit confirmation and approval are required; managed-cloud, disabled, missing, and unknown providers fail closed.",
  inputSchema: triggerWorkflowInputSchema,
  outputSchema: z.object({
    runId: z.string(),
    workflowName: z.string(),
    status: z.literal("queued"),
  }),
  requiredScopes: ["workflows:trigger"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["data-write"],
  },
  async handler(input, ctx) {
    return workflowRuns(ctx).triggerWorkflow(input)
  },
})

export const retryWorkflowRunTool = defineTool<
  RetryWorkflowRunToolInput,
  Awaited<ReturnType<WorkflowRunsToolServices["retryRun"]>>,
  WorkflowRunsToolContext
>({
  name: "retry_workflow_run",
  description:
    "Retry a recorded workflow through its registered runner using rerun or failed-step resume. May repeat external effects, so explicit confirmation and approval are required; only self-hosted workflow deployments are eligible.",
  inputSchema: retryWorkflowRunInputSchema,
  outputSchema: z.object({
    runId: z.string(),
    parentRunId: z.string(),
    mode: z.enum(["rerun", "resume"]),
    resumeFromStep: z.string().nullable(),
  }),
  requiredScopes: ["workflows:retry"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["data-write"],
  },
  async handler(input, ctx) {
    return workflowRuns(ctx).retryRun(input)
  },
})

export const workflowRunsTools = [
  listWorkflowRunsTool,
  getWorkflowRunTool,
  triggerWorkflowTool,
  retryWorkflowRunTool,
] as const
