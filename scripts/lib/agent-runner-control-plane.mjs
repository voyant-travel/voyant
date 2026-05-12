export class ControlPlaneRequestError extends Error {
  constructor({ body, endpoint, responseText, status }) {
    super(formatControlPlaneError({ body, endpoint, responseText, status }))
    this.name = "ControlPlaneRequestError"
    this.body = body
    this.endpoint = endpoint
    this.responseText = responseText
    this.status = status
  }
}

export function controlPlaneConfigFromArgs(args, env = process.env) {
  const url = args.controlPlaneUrl ?? env.AGENT_CONTROL_PLANE_URL
  const token = env.AGENT_CONTROL_PLANE_TOKEN

  if (!url) {
    throw new Error(
      "missing control plane URL; set AGENT_CONTROL_PLANE_URL or pass --control-plane-url",
    )
  }

  if (!token) {
    throw new Error("missing control plane token; set AGENT_CONTROL_PLANE_TOKEN")
  }

  return {
    token,
    url: normalizeControlPlaneUrl(url),
  }
}

export async function submitTickSnapshot({ fetchImpl = fetch, snapshot, token, url }) {
  const response = await fetchImpl(`${normalizeControlPlaneUrl(url)}/api/tick-snapshots`, {
    body: JSON.stringify(snapshot),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  })

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new ControlPlaneRequestError({
      body,
      endpoint: "tick snapshot",
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

export async function requestLatestDispatchPlan({ fetchImpl = fetch, request, token, url }) {
  const response = await fetchImpl(`${normalizeControlPlaneUrl(url)}/api/dispatch-plans/latest`, {
    body: JSON.stringify(request),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  })

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new ControlPlaneRequestError({
      body,
      endpoint: "latest dispatch plan",
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

export async function requestLatestDispatchIntent({ fetchImpl = fetch, request, token, url }) {
  const response = await fetchImpl(`${normalizeControlPlaneUrl(url)}/api/dispatch-intents/latest`, {
    body: JSON.stringify(request),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  })

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new ControlPlaneRequestError({
      body,
      endpoint: "latest dispatch intent",
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

export async function requestActiveDispatchIntent({ fetchImpl = fetch, request, token, url }) {
  const query = new URLSearchParams({
    action: request.action,
    issueNumber: String(request.issueNumber),
    repository: request.repository,
  })
  const response = await fetchImpl(
    `${normalizeControlPlaneUrl(url)}/api/dispatch-intents/active?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: "GET",
    },
  )

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new ControlPlaneRequestError({
      body,
      endpoint: "active dispatch intent read",
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

export async function finishDispatchIntent({ fetchImpl = fetch, id, request, token, url }) {
  const response = await fetchImpl(
    `${normalizeControlPlaneUrl(url)}/api/dispatch-intents/${encodeURIComponent(id)}/finish`,
    {
      body: JSON.stringify(request),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  )

  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new ControlPlaneRequestError({
      body,
      endpoint: "dispatch intent finish",
      responseText: bodyText,
      status: response.status,
    })
  }

  return body
}

function normalizeControlPlaneUrl(url) {
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

function formatControlPlaneError({ body, endpoint, responseText, status }) {
  const detail = body?.error ? `: ${body.error}` : responseText ? `: ${responseText}` : ""
  return `control plane rejected ${endpoint} with ${status}${detail}${formatActiveIntentDetail(body)}`
}

function formatActiveIntentDetail(body) {
  const intent = body?.intent
  if (!intent || typeof intent !== "object") return ""

  const id = typeof intent.id === "string" ? intent.id : undefined
  const holder = typeof intent.lease?.holder === "string" ? intent.lease.holder : undefined
  const expiresAt = typeof intent.lease?.expiresAt === "string" ? intent.lease.expiresAt : undefined

  const parts = [
    id ? `id=${id}` : undefined,
    holder ? `holder=${holder}` : undefined,
    expiresAt ? `expiresAt=${expiresAt}` : undefined,
  ].filter(Boolean)

  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}
