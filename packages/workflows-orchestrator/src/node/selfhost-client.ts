import type { StoredRun } from "./snapshot-run-store.js"

export interface NodeSelfHostWorkflowClientOptions {
  baseUrl: string
  fetch?: typeof fetch
}

export interface SelfHostTriggerRunInput {
  workflowId: string
  input?: unknown
  runId?: string
  tags?: string[]
  triggeredByUserId?: string | null
}

export interface SelfHostResumeRunInput {
  workflowId?: string
  input?: unknown
  resumeFromStep?: string
  seedResults?: Record<string, unknown>
  runId?: string
  tags?: string[]
  triggeredByUserId?: string | null
}

export interface SelfHostResumeRunResult {
  saved: StoredRun
  parentRunId: string
  resumeFromStep: string
}

export interface NodeSelfHostWorkflowClient {
  trigger(input: SelfHostTriggerRunInput): Promise<StoredRun>
  resume(parentRunId: string, input?: SelfHostResumeRunInput): Promise<SelfHostResumeRunResult>
}

export function createNodeSelfHostWorkflowClient(
  opts: NodeSelfHostWorkflowClientOptions,
): NodeSelfHostWorkflowClient {
  const fetchImpl = opts.fetch ?? fetch
  const baseUrl = opts.baseUrl.replace(/\/+$/, "")
  return {
    async trigger(input) {
      const payload = await postJson<{ saved: StoredRun }>(fetchImpl, `${baseUrl}/api/runs`, input)
      return payload.saved
    },
    async resume(parentRunId, input = {}) {
      return postJson<SelfHostResumeRunResult>(
        fetchImpl,
        `${baseUrl}/api/runs/${encodeURIComponent(parentRunId)}/resume`,
        input,
      )
    },
  }
}

async function postJson<T>(fetchImpl: typeof fetch, url: string, body: unknown): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message =
      isObject(parsed) && typeof parsed.message === "string"
        ? parsed.message
        : `self-host workflow request failed with HTTP ${response.status}`
    throw new Error(message)
  }
  return parsed as T
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
