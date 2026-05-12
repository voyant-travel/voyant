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

export type WorkflowRunsFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface WorkflowRunsApiClientOptions {
  apiBase?: string
  baseUrl?: string
  fetcher?: WorkflowRunsFetcher
  credentials?: RequestCredentials
  headers?: HeadersInit
}

export interface WorkflowRunsClientOptions {
  baseUrl: string
  fetcher: WorkflowRunsFetcher
  credentials?: RequestCredentials
  headers?: HeadersInit
}

export class WorkflowRunsApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "WorkflowRunsApiError"
    this.status = status
    this.body = body
  }
}

export const defaultWorkflowRunsFetcher: WorkflowRunsFetcher = (input, init) => fetch(input, init)

export const workflowRunsQueryKeys = {
  all: ["voyant", "workflow-runs"] as const,
  lists: () => [...workflowRunsQueryKeys.all, "list"] as const,
  list: (query: ListWorkflowRunsQuery) => [...workflowRunsQueryKeys.lists(), query] as const,
  details: () => [...workflowRunsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowRunsQueryKeys.details(), id] as const,
} as const

export function createWorkflowRunsClientOptions(
  client?: Partial<WorkflowRunsClientOptions>,
): WorkflowRunsClientOptions {
  return {
    baseUrl: client?.baseUrl ?? "",
    fetcher: client?.fetcher ?? defaultWorkflowRunsFetcher,
    credentials: client?.credentials,
    headers: client?.headers,
  }
}

export function createWorkflowRunsApiClient(
  options: WorkflowRunsApiClientOptions = {},
): WorkflowRunsApi {
  const client = createWorkflowRunsClientOptions({
    baseUrl: options.baseUrl ?? options.apiBase ?? "",
    fetcher: options.fetcher,
    credentials: options.credentials ?? "include",
    headers: options.headers,
  })

  return {
    listRuns: (query) => listWorkflowRuns(query, client),
    getRun: (id) => getWorkflowRun(id, client),
    rerunRun: (id, opts) => rerunWorkflowRun({ id, confirm: opts?.confirm }, client),
    resumeRun: (id) => resumeWorkflowRun(id, client),
  }
}

export async function listWorkflowRuns(
  query: ListWorkflowRunsQuery = {},
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
): Promise<ListWorkflowRunsResponse> {
  return fetchWorkflowRunsJson(
    `/v1/admin/workflow-runs${buildWorkflowRunsSearch(query)}`,
    { method: "GET" },
    client,
  )
}

export async function getWorkflowRun(
  id: string,
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
): Promise<WorkflowRunDetailResponse> {
  return fetchWorkflowRunsJson(
    `/v1/admin/workflow-runs/${encodeURIComponent(id)}`,
    { method: "GET" },
    client,
  )
}

export async function rerunWorkflowRun(
  input: { id: string; confirm?: boolean },
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
): Promise<WorkflowRunActionResult> {
  return runWorkflowRunAction(
    await requestWorkflowRuns(
      `/v1/admin/workflow-runs/${encodeURIComponent(input.id)}/rerun`,
      {
        method: "POST",
        body: JSON.stringify({ confirm: input.confirm ?? false }),
      },
      client,
    ),
  )
}

export async function resumeWorkflowRun(
  id: string,
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
): Promise<WorkflowRunActionResult> {
  return runWorkflowRunAction(
    await requestWorkflowRuns(
      `/v1/admin/workflow-runs/${encodeURIComponent(id)}/resume`,
      { method: "POST" },
      client,
    ),
  )
}

export function workflowRunIsTerminal(status: WorkflowRunStatus): boolean {
  return status !== "running"
}

async function fetchWorkflowRunsJson<T>(
  path: string,
  init: RequestInit,
  client: WorkflowRunsClientOptions,
): Promise<T> {
  const response = await requestWorkflowRuns(path, init, client)
  const body = await safeJson(response)
  if (!response.ok) {
    throw new WorkflowRunsApiError(
      extractErrorMessage(response.status, response.statusText, body),
      response.status,
      body,
    )
  }
  return body as T
}

async function requestWorkflowRuns(
  path: string,
  init: RequestInit,
  client: WorkflowRunsClientOptions,
): Promise<Response> {
  const headers = new Headers(client.headers)
  for (const [key, value] of new Headers(init.headers).entries()) {
    headers.set(key, value)
  }
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const requestInit: RequestInit = { ...init, headers }
  if (client.credentials !== undefined) {
    requestInit.credentials = client.credentials
  }

  return client.fetcher(joinUrl(client.baseUrl, path), requestInit)
}

async function runWorkflowRunAction(res: Response): Promise<WorkflowRunActionResult> {
  const body = await safeJson(res)
  if (res.ok) {
    return { ok: true, data: (body as WorkflowRunActionResponse).data }
  }
  return { ok: false, error: body as WorkflowRunActionError }
}

function buildWorkflowRunsSearch(query: ListWorkflowRunsQuery): string {
  const params = new URLSearchParams()
  if (query.workflowName) params.set("workflowName", query.workflowName)
  if (query.status) params.set("status", query.status)
  if (query.tag) params.set("tag", query.tag)
  if (query.parentRunId) params.set("parentRunId", query.parentRunId)
  if (query.limit !== undefined) params.set("limit", String(query.limit))
  if (query.offset !== undefined) params.set("offset", String(query.offset))
  const search = params.toString()
  return search ? `?${search}` : ""
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(status: number, statusText: string, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    if ("error" in body && typeof body.error === "string") return body.error
    if ("detail" in body && typeof body.detail === "string") return body.detail
  }
  return `Workflow runs API error: ${status} ${statusText}`
}

function joinUrl(baseUrl: string, path: string): string {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl)
  const trimmedBase = resolvedBaseUrl.endsWith("/") ? resolvedBaseUrl.slice(0, -1) : resolvedBaseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function resolveBaseUrl(baseUrl: string): string {
  if (baseUrl.trim()) return baseUrl

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`
  }

  return "http://localhost:3300/api"
}
