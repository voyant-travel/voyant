import path from "node:path"

import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export function remoteBrowserArtifactPlan({
  date = new Date(),
  descriptor,
  item,
  repoRoot,
  workspaceReference,
}) {
  if (!isRemoteWorkspaceDescriptor(descriptor)) {
    throw new Error(
      `remote browser capture requires a remote-sandbox reference; got ${
        descriptor?.kind ?? "unknown"
      }`,
    )
  }

  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const artifactPointer = path.posix.join(
    ".agent-runs",
    "remote-browser",
    `${item.issue.number}-${slug}`,
    timestamp,
  )
  const workspace = path.resolve(repoRoot)
  const artifactDir = path.resolve(workspace, artifactPointer)
  const artifactRoot = path.resolve(workspace, ".agent-runs")

  return {
    artifactDir,
    artifactPointer,
    consoleLog: path.join(artifactDir, "console.jsonl"),
    networkLog: path.join(artifactDir, "network.jsonl"),
    readme: path.join(artifactDir, "README.md"),
    safeArtifactPath: isPathInside(artifactDir, artifactRoot),
    screenshotDir: path.join(artifactDir, "screenshots"),
    summaryJson: path.join(artifactDir, "summary.json"),
    videoDir: path.join(artifactDir, "videos"),
    workspace,
    workspaceReference,
  }
}

export function normalizeRemoteHttpExposure({ port, result }) {
  const url = typeof result === "string" ? result : result?.url
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`remote HTTP exposure for port ${port} did not return a URL`)
  }

  return {
    ...((result && typeof result === "object" && !Array.isArray(result) && result) || {}),
    port,
    url,
  }
}

export async function waitForRemoteHttpReady(
  url,
  { fetchImpl = fetch, intervalMs = 500, timeoutMs },
) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(url, { redirect: "manual" })
      if (response.status < 500) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`timed out waiting for ${url}: ${lastError?.message ?? "no response"}`)
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "agent-task"
}
