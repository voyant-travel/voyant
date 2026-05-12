export class RunnerAppRequestError extends Error {
  constructor({ body, endpoint, responseText, status }) {
    super(formatRunnerAppError({ body, endpoint, responseText, status }))
    this.name = "RunnerAppRequestError"
    this.body = body
    this.endpoint = endpoint
    this.responseText = responseText
    this.status = status
  }
}

export function runnerAppConfigFromArgs(args, env = process.env) {
  const url = args.runnerUrl ?? env.AGENT_RUNNER_URL
  const token = args.runnerToken ?? env.AGENT_RUNNER_TOKEN

  if (!url) {
    throw new Error("missing runner URL; set AGENT_RUNNER_URL or pass --runner-url")
  }

  if (!token) {
    throw new Error("missing runner token; set AGENT_RUNNER_TOKEN or pass --runner-token")
  }

  return {
    token,
    url: normalizeRunnerAppUrl(url),
  }
}

export async function requestRunnerAppCapabilities({ fetchImpl = fetch, token, url }) {
  return requestRunnerAppJson({
    endpoint: "capabilities",
    fetchImpl,
    path: "/api/capabilities",
    token,
    url,
  })
}

export async function requestRecentRunnerSupervisorTicks({
  fetchImpl = fetch,
  limit,
  repository,
  token,
  url,
}) {
  const query = new URLSearchParams({
    repository,
    ...(limit ? { limit: String(limit) } : {}),
  })
  return requestRunnerAppJson({
    endpoint: "recent supervisor ticks",
    fetchImpl,
    path: `/api/supervisor/ticks/recent?${query.toString()}`,
    token,
    url,
  })
}

async function requestRunnerAppJson({ endpoint, fetchImpl = fetch, path, token, url }) {
  const response = await fetchImpl(`${normalizeRunnerAppUrl(url)}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    method: "GET",
  })

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new RunnerAppRequestError({
      body,
      endpoint,
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

export function summarizeControlPlaneCapabilities(capabilities) {
  const tickPersistence = capabilities?.snapshotContracts?.tick?.persistence ?? "unknown"
  const intentPersistence =
    capabilities?.dispatchIntentContracts?.latestSnapshotLease?.persistence ?? "unknown"
  const activeRead = capabilities?.dispatchIntentContracts?.latestSnapshotLease?.activeRead

  return {
    ok:
      capabilities?.service === "agent-control-plane" &&
      tickPersistence === "latest" &&
      intentPersistence === "leased" &&
      activeRead === true,
    detail: `tick snapshots: ${tickPersistence}; dispatch intents: ${intentPersistence}; active read: ${String(activeRead ?? "unknown")}`,
  }
}

export function summarizeRunnerAppCapabilities(capabilities) {
  return {
    ok: Boolean(capabilities?.execution),
    detail: `execution: ${capabilities?.execution?.mode ?? "unknown"}; enabled: ${String(capabilities?.execution?.enabled ?? "unknown")}; tick persistence: ${capabilities?.supervisorTicks?.persistence ?? "unknown"}`,
  }
}

function normalizeRunnerAppUrl(url) {
  return String(url).replace(/\/+$/, "")
}

function parseJsonBody(bodyText) {
  if (!bodyText) return null

  try {
    return JSON.parse(bodyText)
  } catch {
    return null
  }
}

function formatRunnerAppError({ body, endpoint, responseText, status }) {
  const detail = body?.error ? `: ${body.error}` : responseText ? `: ${responseText}` : ""
  return `agent runner rejected ${endpoint} with ${status}${detail}`
}
