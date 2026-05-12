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
    const detail = body?.error ? `: ${body.error}` : bodyText ? `: ${bodyText}` : ""
    throw new Error(`control plane rejected tick snapshot with ${response.status}${detail}`)
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
    const detail = body?.error ? `: ${body.error}` : bodyText ? `: ${bodyText}` : ""
    throw new Error(`control plane rejected latest dispatch plan with ${response.status}${detail}`)
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
