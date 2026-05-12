import type {
  ListWorkflowRunsQuery,
  ListWorkflowRunsResponse,
  WorkflowRunActionError,
  WorkflowRunActionResponse,
  WorkflowRunActionResult,
  WorkflowRunDetailResponse,
  WorkflowRunsApi,
} from "./types.js"

export interface WorkflowRunsApiClientOptions {
  apiBase?: string
  fetcher?: typeof fetch
  credentials?: RequestCredentials
  headers?: HeadersInit
}

export function createWorkflowRunsApiClient(
  options: WorkflowRunsApiClientOptions = {},
): WorkflowRunsApi {
  const apiBase = trimTrailingSlash(options.apiBase ?? "/api")
  const fetcher = options.fetcher ?? fetch
  const credentials = options.credentials ?? "include"

  const request = async (path: string, init?: RequestInit): Promise<Response> =>
    fetcher(`${apiBase}${path}`, {
      credentials,
      ...init,
      headers: {
        ...headersToRecord(options.headers),
        ...headersToRecord(init?.headers),
      },
    })

  return {
    async listRuns(query: ListWorkflowRunsQuery): Promise<ListWorkflowRunsResponse> {
      const params = new URLSearchParams()
      if (query.workflowName) params.set("workflowName", query.workflowName)
      if (query.status) params.set("status", query.status)
      if (query.tag) params.set("tag", query.tag)
      if (query.parentRunId) params.set("parentRunId", query.parentRunId)
      if (query.limit != null) params.set("limit", String(query.limit))
      if (query.offset != null) params.set("offset", String(query.offset))
      const suffix = params.size > 0 ? `?${params.toString()}` : ""
      const res = await request(`/v1/admin/workflow-runs${suffix}`)
      if (!res.ok) throw new Error(`workflow runs list failed: ${res.status}`)
      return (await res.json()) as ListWorkflowRunsResponse
    },

    async getRun(id: string): Promise<WorkflowRunDetailResponse> {
      const res = await request(`/v1/admin/workflow-runs/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`workflow run detail failed: ${res.status}`)
      return (await res.json()) as WorkflowRunDetailResponse
    },

    async rerunRun(id: string, opts: { confirm?: boolean } = {}): Promise<WorkflowRunActionResult> {
      return runAction(
        await request(`/v1/admin/workflow-runs/${encodeURIComponent(id)}/rerun`, {
          method: "POST", // i18n-literal-ok: HTTP verb
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: opts.confirm ?? false }),
        }),
      )
    },

    async resumeRun(id: string): Promise<WorkflowRunActionResult> {
      return runAction(
        await request(`/v1/admin/workflow-runs/${encodeURIComponent(id)}/resume`, {
          method: "POST", // i18n-literal-ok: HTTP verb
          headers: { "Content-Type": "application/json" },
        }),
      )
    },
  }
}

async function runAction(res: Response): Promise<WorkflowRunActionResult> {
  if (res.ok) {
    const json = (await res.json()) as WorkflowRunActionResponse
    return { ok: true, data: json.data }
  }
  const error = (await res.json().catch(() => ({}))) as WorkflowRunActionError
  return { ok: false, error }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return headers
}
