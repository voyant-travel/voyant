import path from "node:path"

const uiEvidenceLabels = new Set([
  "browser:evidence",
  "frontend",
  "needs-browser-evidence",
  "ui",
  "ui-change",
])

export function requiresBrowserEvidence(item) {
  const labels = item.issue?.labels ?? []
  return labels.some((label) => uiEvidenceLabels.has(label.toLowerCase()))
}

export function browserArtifactPlan({
  basePort = 4300,
  date = new Date(),
  item,
  repoRoot,
  workspaceReference,
}) {
  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const workspace = path.resolve(repoRoot, workspaceReference)
  const artifactPointer = path.posix.join(
    "docs/agent-evidence/browser",
    `${item.issue.number}-${slug}`,
    timestamp,
  )
  const artifactDir = path.resolve(workspace, artifactPointer)
  const devServerPort = basePort + (Number(item.issue.number) % 1000)

  return {
    artifactDir,
    artifactPointer,
    consoleLog: path.join(artifactDir, "console.jsonl"),
    devServerPort,
    devServerUrl: `http://127.0.0.1:${devServerPort}`,
    networkLog: path.join(artifactDir, "network.jsonl"),
    screenshotDir: path.join(artifactDir, "screenshots"),
    safeArtifactPath: isPathInside(artifactDir, workspace),
    videoDir: path.join(artifactDir, "videos"),
    workspace,
    workspaceReference,
  }
}

export function browserEvidenceEnvironment({ artifactPlan }) {
  return {
    VOYANT_AGENT_BROWSER_ARTIFACT_DIR: artifactPlan.artifactDir,
    VOYANT_AGENT_BROWSER_ARTIFACT_REFERENCE: artifactPlan.artifactPointer,
    VOYANT_AGENT_DEV_SERVER_PORT: String(artifactPlan.devServerPort),
    VOYANT_AGENT_DEV_SERVER_URL: artifactPlan.devServerUrl,
  }
}

export function browserEvidenceMissingReason(item, uiEvidence) {
  if (!requiresBrowserEvidence(item)) return null

  const normalized = uiEvidence?.trim().toLowerCase()
  if (!normalized || ["n/a", "na", "none", "not applicable", "not provided"].includes(normalized)) {
    return "browser evidence is required for UI-labeled work"
  }

  return null
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
