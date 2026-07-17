import { apps, installationDetail, installations, purgePreview, releases } from "./fixtures.js"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/** Route a request to a seeded fixture; logs so the harness console shows traffic. */
export const mockFetcher = async (url: string, init?: RequestInit): Promise<Response> => {
  const method = (init?.method ?? "GET").toUpperCase()
  const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0] ?? url
  // Simulate latency-free but realistic ordering.
  if (method === "GET" && path.endsWith("/v1/admin/apps")) {
    return json({ data: apps, total: apps.length, limit: 25, offset: 0 })
  }
  if (method === "GET" && path.endsWith("/installations")) {
    return json({ data: installations, total: installations.length, limit: 25, offset: 0 })
  }
  if (method === "GET" && /\/installations\/[^/]+$/.test(path)) {
    return json({ data: installationDetail })
  }
  if (method === "GET" && /\/installations\/[^/]+\/audit$/.test(path)) {
    return json({ data: installationDetail.recentAudit })
  }
  if (method === "GET" && /\/apps\/[^/]+\/releases$/.test(path)) {
    return json({ data: releases })
  }
  if (method === "GET" && /\/apps\/[^/]+$/.test(path)) {
    return json({ data: apps[0] })
  }
  if (method === "POST" && path.endsWith("/purge-preview")) {
    return json({ data: purgePreview })
  }
  if (method === "POST" && /\/installations\/[^/]+\/(pause|resume|uninstall|activate)$/.test(path)) {
    return json({ data: { installation: installationDetail.installation, outcome: "updated" } })
  }
  if (method === "POST" && path.endsWith("/install")) {
    return json({ data: { installation: installationDetail.installation, outcome: "created" } }, 201)
  }
  if (method === "POST" && /\/apps\/[^/]+\/releases/.test(path)) {
    return json({ data: releases[0], digest: releases[0]?.manifestDigest, created: true }, 201)
  }
  if (method === "POST" && path.endsWith("/v1/admin/apps")) {
    return json({ data: apps[0] }, 201)
  }
  return json({ error: `Unhandled ${method} ${path}` }, 404)
}
