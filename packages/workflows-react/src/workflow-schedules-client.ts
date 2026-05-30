// Client for the orchestrator's `/api/schedules/:env` aggregate view.
// Mirrors `workflow-runs-client.ts` so the workflow-schedules UI can be
// pointed at any worker that exposes `@voyantjs/workflows-orchestrator-cloudflare`'s
// schedules handler.

export interface WorkflowScheduleDecl {
  cron?: string
  every?: string | number
  at?: string
  timezone?: string
  enabled?: boolean
  overlap?: "skip" | "queue" | "allow"
  environments?: ("production" | "preview" | "development")[]
  name?: string
  input?: unknown
}

export interface WorkflowScheduleSummary {
  workflowId: string
  scheduleId: string
  schedule: WorkflowScheduleDecl
  /** Epoch millis of the next computed fire, or null when undecidable. */
  nextRunAt: number | null
  enabled: boolean
  disabledReason?: "registration_disabled" | "env_filtered"
  /** Epoch millis of the last scheduler dispatch attempt, when known. */
  lastFireAt?: number | null
  /** Run id produced by the last scheduler dispatch attempt, when known. */
  lastRunId?: string | null
  /** Last scheduler dispatch/lock error, when known. */
  lastError?: string | null
  /** Epoch millis until which this schedule is locked, when known. */
  lockedUntil?: number | null
  /** Epoch millis of the last successful scheduled run, when known. */
  lastSuccessfulRunAt?: number | null
  /** Epoch millis when the persisted scheduler state was last updated. */
  stateUpdatedAt?: number | null
}

export interface ListWorkflowSchedulesResponse {
  environment: string
  versionId: string
  schedulesEnabledByEnv?: boolean
  data: WorkflowScheduleSummary[]
}

export interface WorkflowSchedulesApi {
  listSchedules(environment: string): Promise<ListWorkflowSchedulesResponse>
}

export type WorkflowSchedulesFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface WorkflowSchedulesApiClientOptions {
  /** Base URL for the orchestrator. Defaults to the current origin. */
  apiBase?: string
  baseUrl?: string
  fetcher?: WorkflowSchedulesFetcher
  credentials?: RequestCredentials
  headers?: HeadersInit
}

export interface WorkflowSchedulesClientOptions {
  baseUrl: string
  fetcher: WorkflowSchedulesFetcher
  credentials?: RequestCredentials
  headers?: HeadersInit
}

export class WorkflowSchedulesApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "WorkflowSchedulesApiError"
    this.status = status
    this.body = body
  }
}

export const defaultWorkflowSchedulesFetcher: WorkflowSchedulesFetcher = (input, init) =>
  fetch(input, init)

export const workflowSchedulesQueryKeys = {
  all: ["voyant", "workflow-schedules"] as const,
  list: (environment: string) => [...workflowSchedulesQueryKeys.all, "list", environment] as const,
} as const

export function createWorkflowSchedulesClientOptions(
  client?: Partial<WorkflowSchedulesClientOptions>,
): WorkflowSchedulesClientOptions {
  return {
    baseUrl: client?.baseUrl ?? "",
    fetcher: client?.fetcher ?? defaultWorkflowSchedulesFetcher,
    credentials: client?.credentials,
    headers: client?.headers,
  }
}

export function createWorkflowSchedulesApiClient(
  options: WorkflowSchedulesApiClientOptions = {},
): WorkflowSchedulesApi {
  const client = createWorkflowSchedulesClientOptions({
    baseUrl: options.baseUrl ?? options.apiBase ?? "",
    fetcher: options.fetcher,
    credentials: options.credentials ?? "include",
    headers: options.headers,
  })

  return {
    listSchedules: (environment) => listWorkflowSchedules(environment, client),
  }
}

export async function listWorkflowSchedules(
  environment: string,
  client: WorkflowSchedulesClientOptions = createWorkflowSchedulesClientOptions(),
): Promise<ListWorkflowSchedulesResponse> {
  const path = `/api/schedules/${encodeURIComponent(environment)}`
  const response = await request(path, { method: "GET" }, client)
  const body = await safeJson(response)
  if (!response.ok) {
    throw new WorkflowSchedulesApiError(
      extractErrorMessage(response.status, response.statusText, body),
      response.status,
      body,
    )
  }
  return body as ListWorkflowSchedulesResponse
}

async function request(
  path: string,
  init: RequestInit,
  client: WorkflowSchedulesClientOptions,
): Promise<Response> {
  const headers = new Headers(client.headers)
  for (const [key, value] of new Headers(init.headers).entries()) {
    headers.set(key, value)
  }
  const requestInit: RequestInit = { ...init, headers }
  if (client.credentials !== undefined) {
    requestInit.credentials = client.credentials
  }
  return client.fetcher(joinUrl(client.baseUrl, path), requestInit)
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
    if ("message" in body && typeof body.message === "string") return body.message
  }
  return `Workflow schedules API error: ${status} ${statusText}`
}

function joinUrl(baseUrl: string, path: string): string {
  const resolved = resolveBaseUrl(baseUrl)
  const trimmedBase = resolved.endsWith("/") ? resolved.slice(0, -1) : resolved
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function resolveBaseUrl(baseUrl: string): string {
  if (baseUrl.trim()) return baseUrl
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost:8787"
}
