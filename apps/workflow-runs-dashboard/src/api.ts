/**
 * Thin client for the `/v1/admin/workflow-runs` admin surface
 * (`@voyantjs/workflow-runs/routes`).
 *
 * In same-origin deployments the SPA is served from the operator
 * template's `additionalRoutes` and uses relative paths. Override
 * by setting `VITE_API_BASE` at build time when deploying the SPA
 * separately from the API.
 */

// Default to `/api` to match the operator template's `getApiUrl()`
// convention — the worker mounts admin routes under that prefix.
// Override via VITE_API_BASE for cross-origin deploys (drop the
// trailing slash; the SPA appends paths starting with `/v1/...`).
const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api"

export interface WorkflowRunErrorPayload {
  message: string
  code?: string
  stepName?: string
  stack?: string
}

export interface WorkflowRun {
  id: string
  workflowName: string
  trigger: string
  correlationId: string | null
  tags: string[]
  status: "running" | "succeeded" | "failed" | "cancelled"
  input: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: WorkflowRunErrorPayload | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowRunStep {
  id: string
  runId: string
  stepName: string
  sequence: number
  status: "running" | "succeeded" | "failed" | "skipped" | "compensated"
  output: Record<string, unknown> | null
  error: WorkflowRunErrorPayload | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
}

export interface ListRunsResponse {
  data: WorkflowRun[]
  total: number
  limit: number
  offset: number
}

export interface RunDetailResponse {
  data: { run: WorkflowRun; steps: WorkflowRunStep[] }
}

export interface ListRunsQuery {
  workflowName?: string
  status?: WorkflowRun["status"]
  tag?: string
  limit?: number
  offset?: number
}

export async function listRuns(query: ListRunsQuery): Promise<ListRunsResponse> {
  const params = new URLSearchParams()
  if (query.workflowName) params.set("workflowName", query.workflowName)
  if (query.status) params.set("status", query.status)
  if (query.tag) params.set("tag", query.tag)
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  const url = `${API_BASE}/v1/admin/workflow-runs${params.size > 0 ? `?${params.toString()}` : ""}`
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error(`listRuns failed: ${res.status}`)
  return (await res.json()) as ListRunsResponse
}

export async function getRun(id: string): Promise<RunDetailResponse> {
  const res = await fetch(`${API_BASE}/v1/admin/workflow-runs/${encodeURIComponent(id)}`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error(`getRun failed: ${res.status}`)
  return (await res.json()) as RunDetailResponse
}
