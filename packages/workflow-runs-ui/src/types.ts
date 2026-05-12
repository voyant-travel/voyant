export interface WorkflowRunErrorPayload {
  message: string
  code?: string
  stepName?: string
  stack?: string
}

export type WorkflowRunStatus = "running" | "succeeded" | "failed" | "cancelled"

export interface WorkflowRun {
  id: string
  workflowName: string
  trigger: string
  correlationId: string | null
  tags: string[]
  status: WorkflowRunStatus
  input: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: WorkflowRunErrorPayload | null
  parentRunId: string | null
  triggeredByUserId: string | null
  resumeFromStep: string | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  createdAt: string
  updatedAt: string
}

export type WorkflowRunStepStatus = "running" | "succeeded" | "failed" | "skipped" | "compensated"

export interface WorkflowRunStep {
  id: string
  runId: string
  stepName: string
  sequence: number
  status: WorkflowRunStepStatus
  output: Record<string, unknown> | null
  error: WorkflowRunErrorPayload | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
}

export interface ListWorkflowRunsQuery {
  workflowName?: string
  status?: WorkflowRunStatus
  tag?: string
  parentRunId?: string
  limit?: number
  offset?: number
}

export interface ListWorkflowRunsResponse {
  data: WorkflowRun[]
  total: number
  limit: number
  offset: number
}

export interface WorkflowRunDetailResponse {
  data: { run: WorkflowRun; steps: WorkflowRunStep[] }
}

export interface WorkflowRunActionResponse {
  data: {
    runId: string
    parentRunId: string
    resumeFromStep?: string
  }
}

export interface WorkflowRunActionError {
  error: string
  detail?: string
  idempotency?: "safe" | "unsafe" | "resume-only"
}

export type WorkflowRunActionResult =
  | { ok: true; data: WorkflowRunActionResponse["data"] }
  | { ok: false; error: WorkflowRunActionError }

export interface WorkflowRunsApi {
  listRuns(query: ListWorkflowRunsQuery): Promise<ListWorkflowRunsResponse>
  getRun(id: string): Promise<WorkflowRunDetailResponse>
  rerunRun(id: string, opts?: { confirm?: boolean }): Promise<WorkflowRunActionResult>
  resumeRun(id: string): Promise<WorkflowRunActionResult>
}
