import { dispatchableActions } from "./agent-runner-dispatch.mjs"

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

export async function requestRunnerAppSupervisorTick({ fetchImpl = fetch, request, token, url }) {
  return requestRunnerAppJson({
    endpoint: "supervisor tick",
    fetchImpl,
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
    path: "/api/supervisor/ticks",
    requestBody: JSON.stringify(request),
    token,
    url,
  })
}

export async function requestRunnerAppSupervisorStatus({
  fetchImpl = fetch,
  limit,
  repository,
  token,
  url,
}) {
  const query = new URLSearchParams({
    ...(repository ? { repository } : {}),
    ...(limit ? { limit: String(limit) } : {}),
  })
  const path =
    query.size > 0 ? `/api/supervisor/status?${query.toString()}` : "/api/supervisor/status"
  return requestRunnerAppJson({
    endpoint: "supervisor status",
    fetchImpl,
    path,
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

async function requestRunnerAppJson({
  endpoint,
  fetchImpl = fetch,
  headers = {},
  method = "GET",
  path,
  requestBody,
  token,
  url,
}) {
  const response = await fetchImpl(`${normalizeRunnerAppUrl(url)}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      ...headers,
    },
    ...(requestBody ? { body: requestBody } : {}),
    method,
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
  const policy = summarizeRunnerPolicy(capabilities)

  return {
    ok: Boolean(capabilities?.execution) && policy.ok,
    detail: `execution: ${capabilities?.execution?.mode ?? "unknown"}; enabled: ${String(capabilities?.execution?.enabled ?? "unknown")}; tick persistence: ${capabilities?.supervisorTicks?.persistence ?? "unknown"}; ${policy.detail}`,
  }
}

export function summarizeRunnerPolicy(capabilities) {
  const policy = capabilities?.policy
  if (!policy) {
    return {
      allowedActionCount: null,
      ciRepairAllowedActions: [],
      ciRepairEnabled: false,
      defaultAction: capabilities?.defaults?.action ?? null,
      detail: "policy: unknown",
      maxDailyLeases: null,
      ok: true,
      requiresActionFilter: null,
    }
  }

  const allowedActions = Array.isArray(policy.allowedActions) ? policy.allowedActions : []
  const defaultAction = capabilities?.defaults?.action ?? policy.defaultAction ?? null
  const ciRepairAllowedActions = allowedActions
    .filter((action) => action === "repair-ci" || action === "remote-repair-ci")
    .sort()
  const defaultActionAllowed = !defaultAction || allowedActions.includes(defaultAction)
  const defaultActionDispatchable = !defaultAction || dispatchableActions.has(defaultAction)

  return {
    allowedActionCount: allowedActions.length,
    ciRepairAllowedActions,
    ciRepairEnabled: ciRepairAllowedActions.length > 0,
    defaultAction,
    maxDailyLeases: policy.maxDailyLeases ?? null,
    detail: [
      `allowed actions: ${allowedActions.length}`,
      `default action: ${defaultAction ?? "none"}`,
      `daily lease budget: ${policy.maxDailyLeases ?? "none"}`,
      `requires action filter: ${String(policy.requiresActionFilter ?? "unknown")}`,
      `CI repair opt-in: ${ciRepairAllowedActions.length > 0 ? ciRepairAllowedActions.join(",") : "off"}`,
      defaultActionAllowed ? null : "default action is not allowed",
      defaultActionDispatchable ? null : "default action is not dispatchable",
    ]
      .filter(Boolean)
      .join("; "),
    ok: defaultActionAllowed && defaultActionDispatchable,
    requiresActionFilter: policy.requiresActionFilter ?? null,
  }
}

export function summarizeRunnerSmokeTick(response) {
  const result = response?.result
  const controlPlaneStatus = result?.controlPlane?.status ?? "unknown"
  return {
    ok:
      result?.reason === "dry_run" &&
      Number(controlPlaneStatus) >= 200 &&
      Number(controlPlaneStatus) < 300,
    detail: `reason: ${result?.reason ?? "unknown"}; control plane status: ${String(controlPlaneStatus)}; storage persisted: ${String(response?.storage?.persisted ?? "unknown")}`,
  }
}

export function summarizeRunnerSupervisorStatus(status) {
  const persistence = status?.supervisorTicks?.storage?.persistence ?? "unknown"
  const latestReason = status?.supervisorTicks?.latest?.result?.reason ?? "none"
  const recentCount = Array.isArray(status?.supervisorTicks?.recent)
    ? status.supervisorTicks.recent.length
    : "unknown"
  return {
    ok: status?.service === "agent-runner" && Boolean(status?.capabilities?.execution),
    detail: `repository: ${status?.repository ?? "unknown"}; tick persistence: ${persistence}; latest: ${latestReason}; recent: ${String(recentCount)}`,
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
